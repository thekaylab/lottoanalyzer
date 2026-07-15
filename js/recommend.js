/**
 * recommend.js  —  추천번호 페이지 로직
 *
 * 전역 네임스페이스: window.LottoRecommend
 * 의존: window.LottoPrediction, window.LottoUtils
 *
 * 기능
 * ─────────────────────────────────────────────────────────
 *  · 5가지 알고리즘 선택
 *  · 생성 세트 수 선택 (1~5)
 *  · 번호 고정 (pinned) — 반드시 포함
 *  · 번호 제외 (excluded) — 절대 포함 안 함
 *    (클릭 1회: 고정 | 클릭 2회: 제외 | 클릭 3회: 해제)
 *  · 번호 다시 생성 (개별 / 전체)
 *  · 번호 복사 (클립보드)
 *  · 즐겨찾기 추가/삭제 (LocalStorage)
 *  · 최근 생성 기록 (LocalStorage, 최대 10회)
 *  · 다크모드 + 설정 + 즐겨찾기 새로고침 후 복원
 *
 * @namespace LottoRecommend
 */
window.LottoRecommend = (function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 상수
  // ─────────────────────────────────────────────────────────────

  var STORAGE_KEYS = {
    PREFS:     'lotto-rec-prefs',
    FAVORITES: 'lotto-rec-fav',
    HISTORY:   'lotto-rec-hist',
  };
  var MAX_PINNED    = 5;   // 고정 번호 최대 개수
  var MAX_FAVORITES = 30;  // 즐겨찾기 최대 개수
  var MAX_HISTORY   = 10;  // 기록 최대 개수
  var ALL_NUMBERS   = Array.from({ length: 45 }, function (_, i) { return i + 1; });

  var ALGOS = [
    { key: 'ai-mix',    label: 'AI Mix',       icon: '🤖', desc: '7가지 통계 복합 분석' },
    { key: 'frequency', label: '출현빈도',      icon: '📊', desc: '자주 나온 번호 우선'  },
    { key: 'balanced',  label: '균형형',        icon: '⚖️', desc: '홀짝·구간 균형 최적' },
    { key: 'absent',    label: '미출현',        icon: '❄️', desc: '오래 쉰 번호 우선'   },
    { key: 'random',    label: '완전 랜덤',     icon: '🎲', desc: '순수 무작위 선택'    },
  ];


  // ─────────────────────────────────────────────────────────────
  // 상태
  // ─────────────────────────────────────────────────────────────

  var _data      = null;  // 전체 회차 데이터
  var _state     = {
    algorithm: 'ai-mix',
    setCount:  5,
    pinned:    [],
    excluded:  [],
    results:   [],        // 현재 생성된 세트 배열
  };
  var _favorites = [];
  var _history   = [];


  // ─────────────────────────────────────────────────────────────
  // LocalStorage 관리
  // ─────────────────────────────────────────────────────────────

  function _savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify({
        algorithm: _state.algorithm,
        setCount:  _state.setCount,
        pinned:    _state.pinned,
        excluded:  _state.excluded,
      }));
    } catch (e) {}
  }

  function _loadPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.PREFS);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p.algorithm) _state.algorithm = p.algorithm;
      if (typeof p.setCount === 'number') _state.setCount = p.setCount;
      if (Array.isArray(p.pinned))   _state.pinned    = p.pinned;
      if (Array.isArray(p.excluded)) _state.excluded  = p.excluded;
    } catch (e) {}
  }

  function _saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(_favorites));
    } catch (e) {}
  }

  function _loadFavorites() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      _favorites = raw ? JSON.parse(raw) : [];
    } catch (e) { _favorites = []; }
  }

  function _saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(_history));
    } catch (e) {}
  }

  function _loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      _history = raw ? JSON.parse(raw) : [];
    } catch (e) { _history = []; }
  }


  // ─────────────────────────────────────────────────────────────
  // 초기화
  // ─────────────────────────────────────────────────────────────

  /**
   * 추천 페이지를 초기화한다.
   * app.js에서 데이터 로드 완료 후 호출한다.
   * @param {Object[]} data
   */
  function init(data) {
    _data = data || [];
    _loadPrefs();
    _loadFavorites();
    _loadHistory();
    _renderAlgoTabs();
    _renderSetCountBtns();
    _renderNumGrid();
    _updateConstraintSummary();
    _renderFavorites();
    _renderHistory();
    _bindEvents();
  }


  // ─────────────────────────────────────────────────────────────
  // 렌더링: 알고리즘 탭
  // ─────────────────────────────────────────────────────────────

  function _renderAlgoTabs() {
    var container = document.getElementById('rec-algo-tabs');
    if (!container) return;

    var html = '';
    ALGOS.forEach(function (algo) {
      var active = algo.key === _state.algorithm;
      html += '<button class="algo-tab' + (active ? ' active' : '') + '"'
        + ' data-algo="' + algo.key + '"'
        + ' aria-pressed="' + active + '"'
        + ' title="' + _esc(algo.desc) + '">'
        + '<span class="algo-icon">' + algo.icon + '</span>'
        + '<span class="algo-label">' + algo.label + '</span>'
        + '<span class="algo-desc">' + algo.desc + '</span>'
        + '</button>';
    });
    container.innerHTML = html;
  }


  // ─────────────────────────────────────────────────────────────
  // 렌더링: 세트 수 버튼
  // ─────────────────────────────────────────────────────────────

  function _renderSetCountBtns() {
    for (var i = 1; i <= 5; i++) {
      var btn = document.getElementById('set-count-' + i);
      if (btn) btn.classList.toggle('active', _state.setCount === i);
    }
  }


  // ─────────────────────────────────────────────────────────────
  // 렌더링: 번호 그리드 (고정/제외 상태 표시)
  // ─────────────────────────────────────────────────────────────

  function _renderNumGrid() {
    var grid = document.getElementById('rec-num-grid');
    if (!grid) return;

    var html = '';
    ALL_NUMBERS.forEach(function (n) {
      var isPinned   = _state.pinned.indexOf(n)   !== -1;
      var isExcluded = _state.excluded.indexOf(n) !== -1;
      var cls = 'num-cell'
        + (isPinned   ? ' num-cell--pinned'   : '')
        + (isExcluded ? ' num-cell--excluded' : '');
      var label = n + '번'
        + (isPinned   ? ' (고정)' : '')
        + (isExcluded ? ' (제외)' : '');

      html += '<button class="' + cls + '" data-num="' + n + '"'
        + ' aria-label="' + label + '"'
        + ' aria-pressed="' + (isPinned || isExcluded) + '">'
        + (isPinned ? '📌' : isExcluded ? '✕' : n)
        + '</button>';
    });
    grid.innerHTML = html;
    _updateConstraintSummary();
  }

  /** 고정/제외 요약 및 경고 메시지 업데이트 */
  function _updateConstraintSummary() {
    _updateEl('rec-pinned-display', _state.pinned, '없음', '--pinned');
    _updateEl('rec-excluded-display', _state.excluded, '없음', '--excluded');

    // 가용 번호 부족 경고
    var available = ALL_NUMBERS.filter(function (n) {
      return _state.pinned.indexOf(n) === -1 && _state.excluded.indexOf(n) === -1;
    });
    var needed = 6 - _state.pinned.length;
    var warnEl = document.getElementById('rec-constraint-warn');
    if (warnEl) {
      var show = needed > available.length;
      warnEl.style.display = show ? 'block' : 'none';
      if (show) {
        warnEl.textContent = '⚠️ 사용 가능 번호(' + available.length + '개)가 부족합니다. 제외를 줄여주세요.';
      }
    }

    // 카운터 배지
    var pinnedCnt = document.getElementById('pinned-count');
    if (pinnedCnt) pinnedCnt.textContent = _state.pinned.length;
    var excCnt = document.getElementById('excluded-count');
    if (excCnt) excCnt.textContent = _state.excluded.length;
  }

  function _updateEl(id, arr, emptyText, modClass) {
    var el = document.getElementById(id);
    if (!el) return;
    if (arr.length === 0) {
      el.textContent = emptyText;
      el.className   = 'constraint-val constraint-val--empty';
    } else {
      var sorted = arr.slice().sort(function (a, b) { return a - b; });
      el.textContent = sorted.join(', ') + '번';
      el.className   = 'constraint-val constraint-val' + modClass;
    }
  }


  // ─────────────────────────────────────────────────────────────
  // 렌더링: 생성 결과
  // ─────────────────────────────────────────────────────────────

  function _renderResults(sets) {
    // 결과 섹션 노출
    var section = document.getElementById('rec-results-section');
    if (section) section.style.display = '';

    var container = document.getElementById('rec-results');
    if (!container) return;

    if (!sets || sets.length === 0) {
      container.innerHTML = '<p class="empty-msg">생성된 번호가 없습니다.</p>';
      return;
    }

    var html = '';
    sets.forEach(function (set, idx) {
      var isFav = _isFavorited(set.numbers);
      html += '<article class="result-card" data-set-idx="' + idx + '">'
        + '<div class="result-card-header">'
        + '<span class="result-set-num">'
        + '<span class="set-num-badge">' + (idx + 1) + '</span>'
        + '세트</span>'
        + '<div class="result-actions">'
        + _actionBtn('regen', idx, '🔄', '이 세트 다시 생성', '')
        + _actionBtn('copy',  idx, '📋', '번호 복사', '')
        + _actionBtn('fav',   idx, isFav ? '❤️' : '🤍', '즐겨찾기', isFav ? ' is-fav' : '')
        + '</div>'
        + '</div>'
        + '<div class="result-balls" role="list" aria-label="세트 ' + (idx+1) + ' 번호">'
        + _renderBalls(set.numbers, _state.pinned, _state.excluded)
        + '</div>'
        + '<p class="result-reason">' + _esc(set.reason) + '</p>'
        + '<p class="result-stats">' + _calcStats(set.numbers) + '</p>'
        + '</article>';
    });
    container.innerHTML = html;
  }

  function _actionBtn(action, idx, icon, title, extraCls) {
    return '<button class="result-btn result-btn--' + action + extraCls + '"'
      + ' data-action="' + action + '"'
      + ' data-idx="' + idx + '"'
      + ' aria-label="' + _esc(title) + '"'
      + ' title="' + _esc(title) + '">'
      + icon + '</button>';
  }

  function _renderBalls(numbers, pinned, excluded) {
    pinned   = pinned   || [];
    excluded = excluded || [];
    return numbers.map(function (n) {
      var cls = 'lotto-ball ' + _ballColorClass(n);
      if (pinned.indexOf(n)   !== -1) cls += ' ball--pinned-mark';
      return '<div class="' + cls + '" role="listitem" aria-label="' + n + '번">' + n + '</div>';
    }).join('');
  }

  function _ballColorClass(n) {
    if (n <= 10) return 'ball--yellow';
    if (n <= 20) return 'ball--blue';
    if (n <= 30) return 'ball--red';
    if (n <= 40) return 'ball--gray';
    return 'ball--green';
  }

  function _calcStats(numbers) {
    var sum  = numbers.reduce(function (a, b) { return a + b; }, 0);
    var odd  = numbers.filter(function (n) { return n % 2 !== 0; }).length;
    var low  = numbers.filter(function (n) { return n <= 22; }).length;
    var last = new Set(numbers.map(function (n) { return n % 10; })).size;
    return '합계 <strong>' + sum + '</strong> · 홀 ' + odd + '/짝 ' + (6-odd)
      + ' · 저 ' + low + '/고 ' + (6-low)
      + ' · 끝수 ' + last + '종류';
  }


  // ─────────────────────────────────────────────────────────────
  // 렌더링: 즐겨찾기
  // ─────────────────────────────────────────────────────────────

  function _renderFavorites() {
    var badge = document.getElementById('fav-count-badge');
    if (badge) badge.textContent = _favorites.length;

    var container = document.getElementById('rec-favorites-list');
    if (!container) return;

    if (_favorites.length === 0) {
      container.innerHTML = '<p class="empty-msg">💡 생성된 번호의 ❤️ 버튼으로 즐겨찾기를 추가하세요.</p>';
      return;
    }

    var html = '';
    _favorites.slice().reverse().forEach(function (fav) {
      var date = _formatDateShort(fav.savedAt);
      var algoInfo = _algoInfo(fav.algorithm);
      html += '<div class="fav-item" data-fav-id="' + fav.id + '">'
        + '<div class="fav-item-header">'
        + '<span class="fav-algo-badge">' + algoInfo.icon + ' ' + algoInfo.label + '</span>'
        + '<span class="fav-date">' + date + '</span>'
        + '<button class="fav-delete-btn icon-btn" data-fav-id="' + fav.id + '" aria-label="즐겨찾기 삭제" title="삭제">✕</button>'
        + '</div>'
        + '<div class="fav-balls" role="list">'
        + _renderBalls(fav.numbers, [], [])
        + '</div>'
        + '<div class="fav-footer">'
        + '<span class="fav-nums-text">' + fav.numbers.join(', ') + '</span>'
        + '<button class="btn-copy-small" data-copy="' + fav.numbers.join(',') + '">📋 복사</button>'
        + '</div>'
        + '</div>';
    });
    container.innerHTML = html;
  }


  // ─────────────────────────────────────────────────────────────
  // 렌더링: 생성 기록
  // ─────────────────────────────────────────────────────────────

  function _renderHistory() {
    var container = document.getElementById('rec-history-list');
    if (!container) return;

    if (_history.length === 0) {
      container.innerHTML = '<p class="empty-msg">📝 번호를 생성하면 여기에 기록이 남습니다.</p>';
      return;
    }

    var html = '';
    _history.forEach(function (entry, eIdx) {
      var date     = _formatDateShort(entry.timestamp);
      var algoInfo = _algoInfo(entry.algorithm);
      var isFirst  = eIdx === 0;

      html += '<details class="hist-item"' + (isFirst ? ' open' : '') + '>'
        + '<summary class="hist-summary">'
        + '<div class="hist-summary-left">'
        + '<span class="fav-algo-badge">' + algoInfo.icon + ' ' + algoInfo.label + '</span>'
        + '<span class="hist-meta">' + entry.sets.length + '세트 · ' + date + '</span>'
        + '</div>'
        + '<span class="hist-chevron">▾</span>'
        + '</summary>'
        + '<div class="hist-sets-list">';

      entry.sets.forEach(function (set, si) {
        var pinnedMark = entry.pinned && entry.pinned.length > 0
          ? '<span class="hist-pin">📌' + entry.pinned.join(',') + '</span>' : '';
        html += '<div class="hist-set">'
          + '<span class="hist-set-badge">' + (si+1) + '</span>'
          + '<div class="hist-balls">'
          + _renderBalls(set.numbers, entry.pinned || [], [])
          + '</div>'
          + pinnedMark
          + '<button class="btn-copy-small" data-copy="' + set.numbers.join(',') + '">📋</button>'
          + '</div>';
      });

      html += '</div></details>';
    });
    container.innerHTML = html;
  }


  // ─────────────────────────────────────────────────────────────
  // 이벤트 바인딩
  // ─────────────────────────────────────────────────────────────

  function _bindEvents() {

    // ── 알고리즘 탭 ──
    _on('rec-algo-tabs', 'click', function (e) {
      var btn = e.target.closest('[data-algo]');
      if (!btn) return;
      _state.algorithm = btn.dataset.algo;
      _savePrefs();
      _renderAlgoTabs();
    });

    // ── 세트 수 ──
    for (var i = 1; i <= 5; i++) {
      (function (cnt) {
        var btn = document.getElementById('set-count-' + cnt);
        if (btn) btn.addEventListener('click', function () {
          _state.setCount = cnt;
          _savePrefs();
          _renderSetCountBtns();
        });
      })(i);
    }

    // ── 번호 그리드: 고정/제외 토글 ──
    _on('rec-num-grid', 'click', function (e) {
      var cell = e.target.closest('[data-num]');
      if (!cell) return;
      _toggleNumber(parseInt(cell.dataset.num, 10));
    });

    // ── 고정/제외 초기화 ──
    _on('rec-clear-pinned', 'click', function () {
      _state.pinned = [];
      _savePrefs();
      _renderNumGrid();
    });
    _on('rec-clear-excluded', 'click', function () {
      _state.excluded = [];
      _savePrefs();
      _renderNumGrid();
    });
    _on('rec-clear-all-constraints', 'click', function () {
      _state.pinned   = [];
      _state.excluded = [];
      _savePrefs();
      _renderNumGrid();
    });

    // ── 번호 생성 ──
    _on('rec-generate-btn', 'click', _generate);

    // ── 전체 다시 생성 ──
    _on('rec-regen-all-btn', 'click', _generate);

    // ── 결과 액션 (복사/즐겨찾기/재생성) ──
    _on('rec-results', 'click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var idx    = parseInt(btn.dataset.idx, 10);
      if (action === 'copy')  _copySet(idx);
      if (action === 'fav')   _toggleFavorite(idx, btn);
      if (action === 'regen') _regenSet(idx);
    });

    // ── 즐겨찾기 삭제 / 복사 ──
    _on('rec-favorites-list', 'click', function (e) {
      var delBtn = e.target.closest('.fav-delete-btn');
      if (delBtn) {
        var id = parseInt(delBtn.dataset.favId, 10);
        _favorites = _favorites.filter(function (f) { return f.id !== id; });
        _saveFavorites();
        _renderFavorites();
        _refreshResultFavBtns();
        return;
      }
      var copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) _copyToClipboard(copyBtn.dataset.copy.replace(/,/g, ', '));
    });

    // ── 즐겨찾기 전체 삭제 ──
    _on('rec-clear-fav-btn', 'click', function () {
      if (!window.confirm('즐겨찾기를 모두 삭제하시겠습니까?')) return;
      _favorites = [];
      _saveFavorites();
      _renderFavorites();
      _refreshResultFavBtns();
    });

    // ── 기록 복사 ──
    _on('rec-history-list', 'click', function (e) {
      var copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) _copyToClipboard(copyBtn.dataset.copy.replace(/,/g, ', '));
    });

    // ── 기록 전체 삭제 ──
    _on('rec-clear-hist-btn', 'click', function () {
      if (!window.confirm('생성 기록을 모두 삭제하시겠습니까?')) return;
      _history = [];
      _saveHistory();
      _renderHistory();
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 번호 토글 (일반 → 고정 → 제외 → 일반)
  // ─────────────────────────────────────────────────────────────

  function _toggleNumber(n) {
    var isPinned   = _state.pinned.indexOf(n)   !== -1;
    var isExcluded = _state.excluded.indexOf(n) !== -1;

    if (!isPinned && !isExcluded) {
      // 일반 → 고정
      if (_state.pinned.length >= MAX_PINNED) {
        _toast('고정 번호는 최대 ' + MAX_PINNED + '개까지 가능합니다.', 'warning');
        return;
      }
      _state.pinned.push(n);

    } else if (isPinned) {
      // 고정 → 제외
      _state.pinned   = _state.pinned.filter(function (x) { return x !== n; });
      _state.excluded.push(n);

    } else {
      // 제외 → 일반
      _state.excluded = _state.excluded.filter(function (x) { return x !== n; });
    }

    _savePrefs();
    _renderNumGrid();
  }


  // ─────────────────────────────────────────────────────────────
  // 생성
  // ─────────────────────────────────────────────────────────────

  function _generate() {
    var Pred = window.LottoPrediction;
    if (!Pred) { _toast('추천 모듈을 찾을 수 없습니다.', 'error'); return; }

    // 가용 번호 검증
    var available = ALL_NUMBERS.filter(function (n) {
      return _state.pinned.indexOf(n) === -1 && _state.excluded.indexOf(n) === -1;
    });
    if (6 - _state.pinned.length > available.length) {
      _toast('사용 가능 번호가 부족합니다. 제외 번호를 줄여주세요.', 'error');
      return;
    }

    var options = { pinned: _state.pinned.slice(), excluded: _state.excluded.slice(), count: _state.setCount };
    var result  = _runAlgo(options);
    if (!result) return;

    _state.results = result.sets;
    _renderResults(result.sets);

    // 면책 문구
    var disc = document.getElementById('rec-disclaimer');
    if (disc) disc.textContent = result.disclaimer;

    // 기록 저장
    _history.unshift({
      id:        Date.now(),
      sets:      result.sets,
      algorithm: _state.algorithm,
      pinned:    _state.pinned.slice(),
      excluded:  _state.excluded.slice(),
      timestamp: new Date().toISOString(),
    });
    if (_history.length > MAX_HISTORY) _history.splice(MAX_HISTORY);
    _saveHistory();
    _renderHistory();

    // 결과로 스크롤
    var sec = document.getElementById('rec-results-section');
    if (sec) setTimeout(function () { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  }

  /** 개별 세트 재생성 */
  function _regenSet(idx) {
    if (!_state.results) return;
    var options = { pinned: _state.pinned.slice(), excluded: _state.excluded.slice(), count: 1 };
    var result  = _runAlgo(options);
    if (!result) return;
    _state.results[idx] = result.sets[0];
    _renderResults(_state.results);
  }

  /**
   * 현재 알고리즘을 options로 실행하고 결과를 반환한다.
   * _generate, _regenSet 에서 공통으로 사용.
   * @param {{pinned:number[], excluded:number[], count:number}} options
   * @returns {Object|null} 결과 객체 또는 오류 시 null
   */
  function _runAlgo(options) {
    var Pred = window.LottoPrediction;
    if (!Pred) { _toast('추천 모듈을 찾을 수 없습니다.', 'error'); return null; }
    try {
      switch (_state.algorithm) {
        case 'random':    return Pred.generateRandom(options);
        case 'frequency': return Pred.generateFrequency(_data, options);
        case 'absent':    return Pred.generateAbsent(_data, options);
        case 'balanced':  return Pred.generateBalanced(_data, options);
        default:          return Pred.generateAIMix(_data, options);
      }
    } catch (e) {
      console.error('[Recommend] 알고리즘 실행 오류:', e);
      _toast('번호 생성 중 오류가 발생했습니다.', 'error');
      return null;
    }
  }


  // ─────────────────────────────────────────────────────────────
  // 복사
  // ─────────────────────────────────────────────────────────────

  function _copySet(idx) {
    if (!_state.results || !_state.results[idx]) return;
    _copyToClipboard(_state.results[idx].numbers.join(', '));
  }

  function _copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(function () { _toast('📋 복사됨: ' + text, 'success'); })
        .catch(function () { _fallbackCopy(text); });
    } else {
      _fallbackCopy(text);
    }
  }

  function _fallbackCopy(text) {
    var el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); _toast('📋 복사됨: ' + text, 'success'); }
    catch (e) { _toast('복사에 실패했습니다.', 'error'); }
    document.body.removeChild(el);
  }


  // ─────────────────────────────────────────────────────────────
  // 즐겨찾기
  // ─────────────────────────────────────────────────────────────

  function _toggleFavorite(idx, btn) {
    if (!_state.results || !_state.results[idx]) return;
    var set  = _state.results[idx];
    var nums = set.numbers;
    var key  = nums.join(',');

    // 이미 즐겨찾기인지 확인
    var existIdx = -1;
    for (var i = 0; i < _favorites.length; i++) {
      if (_favorites[i].numbers.join(',') === key) { existIdx = i; break; }
    }

    if (existIdx !== -1) {
      _favorites.splice(existIdx, 1);
      _toast('즐겨찾기에서 제거되었습니다.', 'info');
      if (btn) { btn.textContent = '🤍'; btn.classList.remove('is-fav'); btn.setAttribute('aria-pressed', 'false'); }
    } else {
      if (_favorites.length >= MAX_FAVORITES) _favorites.pop(); // 오래된 것 제거
      _favorites.unshift({
        id:        Date.now(),
        numbers:   nums,
        reason:    set.reason,
        algorithm: _state.algorithm,
        savedAt:   new Date().toISOString(),
      });
      _toast('❤️ 즐겨찾기에 저장되었습니다.', 'success');
      if (btn) { btn.textContent = '❤️'; btn.classList.add('is-fav'); btn.setAttribute('aria-pressed', 'true'); }
    }

    _saveFavorites();
    _renderFavorites();
  }

  function _isFavorited(numbers) {
    var key = numbers.join(',');
    for (var i = 0; i < _favorites.length; i++) {
      if (_favorites[i].numbers.join(',') === key) return true;
    }
    return false;
  }

  function _refreshResultFavBtns() {
    if (!_state.results) return;
    _state.results.forEach(function (set, idx) {
      var btn = document.querySelector('[data-action="fav"][data-idx="' + idx + '"]');
      if (!btn) return;
      var isFav = _isFavorited(set.numbers);
      btn.textContent = isFav ? '❤️' : '🤍';
      btn.classList.toggle('is-fav', isFav);
      btn.setAttribute('aria-pressed', String(isFav));
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 유틸
  // ─────────────────────────────────────────────────────────────

  function _on(id, event, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _toast(msg, type) {
    if (window.LottoUtils && window.LottoUtils.showToast) {
      window.LottoUtils.showToast(msg, type || 'info', 2500);
    } else {
      console.log('[Toast]', msg);
    }
  }

  function _algoInfo(key) {
    for (var i = 0; i < ALGOS.length; i++) {
      if (ALGOS[i].key === key) return ALGOS[i];
    }
    return { icon: '🎯', label: key };
  }

  function _formatDateShort(isoStr) {
    try {
      var d = new Date(isoStr);
      return d.getMonth() + 1 + '/' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) { return ''; }
  }


  // ─────────────────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────────────────
  return {
    init: init,
  };

})();
