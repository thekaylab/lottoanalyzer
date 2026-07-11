/**
 * app.js  —  LottoLens 메인 진입점
 *
 * 전역 네임스페이스 방식으로 동작 — file:// 프로토콜 지원
 * 의존 순서: utils.js → storage.js → analysis.js → app.js
 *
 * 담당:
 *  1. 테마 초기화 및 토글
 *  2. 사이드바 드로어 (모바일)
 *  3. 페이지 전환
 *  4. 빈도 차트 탭
 *  5. 데이터 로드 오케스트레이션 (LottoStorage → LottoUtils → DOM)
 */
(function () {
  'use strict';

  // 의존 네임스페이스 단축 참조
  var Storage  = window.LottoStorage;
  var Utils    = window.LottoUtils;


  /* ═══════════════════════════════════════════
     DOM 로드 완료 후 초기화
  ═══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initSidebar();
    initPageNavigation();
    initStatsRangeTabs();

    // 데이터 로드 (비동기)
    initData();
  });


  /* ═══════════════════════════════════════════
     1. 데이터 로드 & UI 렌더링
  ═══════════════════════════════════════════ */

  /**
   * 데이터를 로드하고 대시보드 UI를 업데이트한다.
   */
  function initData() {
    // 로딩 상태 시작
    setDashboardLoading(true);

    Storage.loadLottoData()
      .then(function (data) {
        var latest = Storage.getLatestRound(data);

        if (!latest) throw new Error('표시할 데이터가 없습니다.');

        // 카드 1: 최신 회차 정보
        renderLatestRoundCard(latest);

        // 카드 2: 최근 당첨번호 + 이전 회차 미니 볼
        renderWinningNumbersCard(data);

        // 페이지 헤더 회차 배지
        var elRound = document.getElementById('current-round');
        if (elRound) elRound.textContent = Utils.formatNumber(latest.round);

        // 홈 카드 6 차트 초기화
        if (window.LottoChart) {
          window.LottoChart.initHomeChart(data, 0);
        }

        // 추천번호 페이지 초기화
        if (window.LottoRecommend) {
          window.LottoRecommend.init(data);
        }

        // 전역에 데이터 보관 (통계 페이지에서 사용)
        window._lottoData = data;
      })
      .catch(function (err) {
        console.error('[app] 데이터 로드 실패:', err);
        renderErrorState(err.message);
        Utils.showToast('데이터 로드 실패: ' + err.message, 'error', 5000);
      })
      .finally(function () {
        setDashboardLoading(false);
      });
  }


  /* ─────────────────────────────────────────
     1-1. 카드 1: 최신 회차 정보
  ───────────────────────────────────────── */

  /**
   * 카드 1의 회차 정보를 실제 데이터로 채운다.
   * @param {Object} round - LottoRound 객체
   */
  function renderLatestRoundCard(round) {
    // 회차
    _setText('info-round', Utils.formatNumber(round.round) + '회');

    // 추첨일
    _setText('info-date', Utils.formatDateShort(round.date));

    // 1등 당첨금 (JSON에 prize 없으면 "—")
    _setText('info-prize', round.prize ? _formatPrizeKor(round.prize) : '—');

    // 1등 당첨자
    _setText('info-winners', round.winners ? Utils.formatNumber(round.winners) + '명' : '—');

    // 총 판매액
    _setText('info-sales', round.sales ? _formatPrizeKor(round.sales) : '—');

    // 다음 추첨 D-Day (다음 토요일 기준)
    _setText('info-dday', Utils.calcNextDrawDday());
  }

  /**
   * ID로 엘리먼트를 찾아 텍스트를 교체하고 스켈레톤 클래스를 제거한다.
   * @param {string} id
   * @param {string} text
   */
  function _setText(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('skeleton');
    el.removeAttribute('aria-busy');
    el.textContent = text;
  }


  /* ─────────────────────────────────────────
     1-2. 카드 2: 최근 당첨번호
  ───────────────────────────────────────── */

  /**
   * 카드 2의 볼과 이전 회차 미니 볼을 렌더링한다.
   * @param {Object[]} data - 전체 데이터 (최신순)
   */
  function renderWinningNumbersCard(data) {
    var latest = data[0];

    // 회차 배지
    var badge = document.getElementById('winning-round-badge');
    if (badge) {
      badge.classList.remove('skeleton');
      badge.removeAttribute('aria-busy');
      badge.textContent = Utils.formatNumber(latest.round) + '회';
    }

    // 당첨번호 볼 행
    var ballRow = document.getElementById('winning-ball-row');
    if (ballRow) {
      ballRow.setAttribute('aria-label', latest.round + '회차 당첨 번호');
      Utils.renderBallRow(ballRow, latest.numbers, latest.bonus);
    }

    // 이전 2회차 미니 볼
    var prevContainer = document.getElementById('prev-rounds-list');
    if (prevContainer && data.length >= 2) {
      prevContainer.innerHTML = '';

      var prevRounds = data.slice(1, 3);
      prevRounds.forEach(function (round) {
        var item = document.createElement('div');
        item.className = 'prev-round-item';

        var label = document.createElement('span');
        label.className = 'prev-round-label';
        label.textContent = Utils.formatNumber(round.round) + '회';

        var miniBalls = document.createElement('div');
        miniBalls.className = 'mini-balls';
        miniBalls.setAttribute('aria-label', round.round + '회 번호');
        Utils.renderMiniBalls(miniBalls, round.numbers);

        item.appendChild(label);
        item.appendChild(miniBalls);
        prevContainer.appendChild(item);
      });
    }
  }


  /* ─────────────────────────────────────────
     1-3. 오류 상태 표시
  ───────────────────────────────────────── */

  /**
   * 데이터 로드 실패 시 카드 영역에 오류 메시지를 표시한다.
   * @param {string} message
   */
  function renderErrorState(message) {
    ['info-round', 'info-date', 'info-prize', 'info-winners', 'info-sales', 'info-dday'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.remove('skeleton');
        el.textContent = id === 'info-round' ? '오류' : '—';
      }
    });

    var badge = document.getElementById('winning-round-badge');
    if (badge) badge.textContent = '오류';

    var ballRow = document.getElementById('winning-ball-row');
    if (ballRow) {
      ballRow.innerHTML = '<span style="color:var(--clr-red);font-size:var(--fs-sm);padding:0.5rem">'
        + message + '</span>';
    }
  }


  /* ─────────────────────────────────────────
     1-4. 로딩 상태 토글
  ───────────────────────────────────────── */

  /**
   * 대시보드 카드들의 로딩 스켈레톤을 제어한다.
   * @param {boolean} loading
   */
  function setDashboardLoading(loading) {
    ['info-round', 'info-date', 'info-prize', 'info-winners', 'info-sales', 'info-dday'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('skeleton', loading);
      el.setAttribute('aria-busy', loading ? 'true' : 'false');
    });

    var badge = document.getElementById('winning-round-badge');
    if (badge) {
      badge.classList.toggle('skeleton', loading);
      badge.setAttribute('aria-busy', loading ? 'true' : 'false');
    }
  }


  /* ─────────────────────────────────────────
     1-5. 내부: 금액 포맷 (억/천만 원)
  ───────────────────────────────────────── */

  /**
   * 숫자를 한국어 금액 약식으로 포맷한다.
   * 예: 2_130_000_000 → "21억 3천만 원"
   * @param   {number} num
   * @returns {string}
   */
  function _formatPrizeKor(num) {
    if (!num || isNaN(num)) return '—';
    var eok    = Math.floor(num / 100_000_000);
    var manRem = Math.floor((num % 100_000_000) / 10_000_000);
    var result = '';
    if (eok    > 0) result += eok + '억 ';
    if (manRem > 0) result += manRem + '천만 ';
    return (result.trim() || Utils.formatNumber(num)) + ' 원';
  }


  /* ═══════════════════════════════════════════
     2. 테마 (다크 / 라이트)
  ═══════════════════════════════════════════ */

  function initTheme() {
    var saved = localStorage.getItem('lotto-theme');
    applyTheme(saved || 'dark');

    // ① 사이드바 슬라이드 체크박스
    var toggleCheck = document.getElementById('theme-toggle');
    if (toggleCheck) {
      toggleCheck.addEventListener('change', function () {
        applyTheme(toggleCheck.checked ? 'light' : 'dark');
      });
    }

    // ② 모바일 헤더 버튼
    var toggleMobile = document.getElementById('theme-toggle-mobile');
    if (toggleMobile) {
      toggleMobile.addEventListener('click', function () {
        var current = document.body.getAttribute('data-theme') || 'dark';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }

    // ③ 설정 페이지 체크박스
    var darkCheck = document.getElementById('dark-mode-toggle');
    if (darkCheck) {
      darkCheck.addEventListener('change', function () {
        applyTheme(darkCheck.checked ? 'dark' : 'light');
      });
    }
  }

  /**
   * 테마 적용 + 모든 UI 동기화
   * @param {'dark'|'light'} theme
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('lotto-theme', theme);

    var isLight = theme === 'light';

    // 슬라이드 체크박스: checked = 라이트
    var toggleCheck = document.getElementById('theme-toggle');
    if (toggleCheck) toggleCheck.checked = isLight;

    // 설정 페이지 체크박스 (다크 모드 토글이므로 반전)
    var darkCheck = document.getElementById('dark-mode-toggle');
    if (darkCheck) darkCheck.checked = !isLight;

    // 모바일 아이콘 교체 (달 ↔ 해)
    var mobileIcon = document.getElementById('mobile-theme-icon');
    if (mobileIcon) {
      mobileIcon.innerHTML = isLight
        ? '<circle cx="12" cy="12" r="5"/>'
          + '<line x1="12" y1="1" x2="12" y2="3"/>'
          + '<line x1="12" y1="21" x2="12" y2="23"/>'
          + '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>'
          + '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>'
          + '<line x1="1" y1="12" x2="3" y2="12"/>'
          + '<line x1="21" y1="12" x2="23" y2="12"/>'
          + '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>'
          + '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
    }

    // meta theme-color (모바일 브라우저 상단바)
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isLight ? '#f7f7ff' : '#0d0d1a');
  }


  /* ═══════════════════════════════════════════
     3. 사이드바 모바일 드로어
  ═══════════════════════════════════════════ */

  function initSidebar() {
    var hamburger = document.getElementById('hamburger-btn');
    var sidebar   = document.getElementById('sidebar');
    var overlay   = document.getElementById('sidebar-overlay');

    if (!hamburger || !sidebar || !overlay) return;

    function open() {
      sidebar.classList.add('is-open');
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
      hamburger.classList.add('is-open');
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.setAttribute('aria-label', '메뉴 닫기');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', '메뉴 열기');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', function () {
      sidebar.classList.contains('is-open') ? close() : open();
    });

    overlay.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close();
    });

    // 사이드바 링크 클릭 시 모바일에서 자동 닫기
    sidebar.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth < 1024) close();
      });
    });
  }


  /* ═══════════════════════════════════════════
     4. 페이지 전환
  ═══════════════════════════════════════════ */

  function initPageNavigation() {
    var pages = document.querySelectorAll('.page');
    var statsChartsRendered = false;

    function switchPage(pageId) {
      pages.forEach(function (p) {
        p.classList.remove('active');
        p.setAttribute('aria-hidden', 'true');
      });

      var target = document.getElementById('page-' + pageId);
      if (target) {
        target.classList.add('active');
        target.setAttribute('aria-hidden', 'false');
      }

      document.querySelectorAll('.sidebar .nav-link').forEach(function (link) {
        var active = link.dataset.page === pageId;
        link.classList.toggle('active', active);
        link.setAttribute('aria-current', active ? 'page' : 'false');
      });

      document.querySelectorAll('.bottom-nav-item').forEach(function (item) {
        var active = item.dataset.page === pageId;
        item.classList.toggle('active', active);
        item.setAttribute('aria-current', active ? 'page' : 'false');
      });

      history.replaceState(null, '', '#' + pageId);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // 통계 페이지 진입 시 최초 1회만 차트 렌더링
      if (pageId === 'stats' && !statsChartsRendered && window.LottoChart && window._lottoData) {
        statsChartsRendered = true;
        setTimeout(function () {
          window.LottoChart.initAllCharts(window._lottoData, 0);
        }, 50); // 페이지 전환 애니메이션 완료 후 렌더
      }
    }

    document.querySelectorAll('[data-page]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var id = link.dataset.page;
        if (id) switchPage(id);
      });
    });

    // URL 해시로 초기 페이지 결정
    var hash  = window.location.hash.slice(1);
    var valid = ['home', 'analysis', 'recommend', 'stats', 'settings'];
    switchPage(valid.indexOf(hash) !== -1 ? hash : 'home');
  }


  /* ═══════════════════════════════════════════
     5. 통계 페이지 범위 탭
  ═══════════════════════════════════════════ */

  /**
   * 통계 페이지의 범위 선택 탭(전체/50/30/10회)에 이벤트를 연결한다.
   * 탭 클릭 시 모든 차트를 해당 범위로 갱신한다.
   */
  function initStatsRangeTabs() {
    var btns = document.querySelectorAll('.stats-range-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        var limit = parseInt(btn.dataset.statsRange, 10) || 0;
        if (window.LottoChart && window._lottoData) {
          window.LottoChart.updateAllCharts(window._lottoData, limit);
        }
      });
    });
  }

})();
