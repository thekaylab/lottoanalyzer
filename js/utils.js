/**
 * utils.js  —  공통 유틸리티 함수 모음
 *
 * 역할:
 *  - 숫자 / 날짜 포맷팅
 *  - 로또 볼 DOM 생성
 *  - 로딩 스켈레톤 상태 제어
 *  - 토스트 알림
 *  - 클립보드 복사
 *  - 디바운스 / 스로틀
 *  - 배열 / 수학 유틸
 *
 * @module utils
 */

window.LottoUtils = (function () {

  // ─────────────────────────────────────────────────────────────
  // 1. 숫자 / 통계 포맷팅
  // ─────────────────────────────────────────────────────────────

  /**
   * 숫자에 천 단위 콤마 추가
   * @param   {number} num
   * @returns {string} 예: 1152 → "1,152"
   */
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return new Intl.NumberFormat('ko-KR').format(num);
  }

  /**
   * 금액 형식 (원화 약식)
   * @param   {number} num
   * @returns {string} 예: 1_500_000_000 → "15억 원"
   */
  function formatPrize(num) {
    if (!num) return '—';
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}억 원`;
    if (num >= 10_000_000)    return `${Math.round(num / 10_000_000)}천만 원`;
    return `${formatNumber(num)} 원`;
  }

  /**
   * 퍼센트 포맷 (소수점 1자리)
   * @param   {number} value
   * @returns {string}
   */
  function formatPercent(value) {
    if (value === null || value === undefined) return '—%';
    return `${Number(value).toFixed(1)}%`;
  }


  // ─────────────────────────────────────────────────────────────
  // 2. 날짜 포맷팅
  // ─────────────────────────────────────────────────────────────

  /**
   * ISO 날짜 → 한국어 표시 (예: "2026년 7월 4일 (토)")
   * @param   {string} isoDate - "YYYY-MM-DD"
   * @returns {string}
   */
  function formatDate(isoDate) {
    if (!isoDate) return '—';
    try {
      // 시간대 오프셋 보정: "YYYY-MM-DD" 파싱 시 UTC로 처리되는 것을 방지
      const [y, m, d] = isoDate.split('-').map(Number);
      const date = new Date(y, m - 1, d); // 로컬 타임으로 생성
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      }).format(date);
    } catch {
      return isoDate;
    }
  }

  /**
   * ISO 날짜 → 짧은 형식 (예: "2026. 07. 04")
   * @param   {string} isoDate
   * @returns {string}
   */
  function formatDateShort(isoDate) {
    if (!isoDate) return '—';
    try {
      const [y, m, d] = isoDate.split('-');
      return `${y}. ${m}. ${d}`;
    } catch {
      return isoDate;
    }
  }

  /**
   * 다음 토요일까지 D-Day 계산 (로또 추첨은 매주 토요일)
   * @param   {string} [fromIsoDate] - 기준일 (생략 시 오늘)
   * @returns {string} "D-5", "D-Day", "D+1" 등
   */
  function calcNextDrawDday(fromIsoDate) {
    const now  = fromIsoDate ? (() => { const [y,m,d]=fromIsoDate.split('-').map(Number); return new Date(y,m-1,d); })() : new Date();
    const day  = now.getDay(); // 0=일, 6=토
    const diff = day === 6 ? 0 : (6 - day); // 오늘이 토요일이면 D-Day
    if (diff === 0) return 'D-Day';
    return `D-${diff}`;
  }

  /**
   * 상대 날짜 (예: "3일 전", "1주 전")
   * @param   {string} isoDate
   * @returns {string}
   */
  function formatRelativeDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-').map(Number);
    const diff   = Date.now() - new Date(y, m - 1, d).getTime();
    const days   = Math.floor(diff / 86_400_000);
    const weeks  = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (days < 1)    return '오늘';
    if (days < 7)    return `${days}일 전`;
    if (weeks < 5)   return `${weeks}주 전`;
    if (months < 12) return `${months}달 전`;
    return `${Math.floor(months / 12)}년 전`;
  }


  // ─────────────────────────────────────────────────────────────
  // 3. 로또 볼 유틸
  // ─────────────────────────────────────────────────────────────

  /**
   * 번호에 따른 볼 색상 범위 반환
   * @param   {number} num - 1~45
   * @returns {'yellow'|'blue'|'red'|'gray'|'green'}
   */
  function getBallColor(num) {
    if (num <= 10) return 'yellow';
    if (num <= 20) return 'blue';
    if (num <= 30) return 'red';
    if (num <= 40) return 'gray';
    return 'green';
  }

  /**
   * 로또 볼 <div> 엘리먼트 생성
   * @param   {number}  num     - 번호 (1~45)
   * @param   {boolean} [isBonus=false] - 보너스 볼 여부
   * @param   {boolean} [small=false]   - 소형(.mini-ball) 여부
   * @returns {HTMLElement}
   */
  function createBallElement(num, isBonus = false, small = false) {
    const el = document.createElement('div');
    const color = getBallColor(num);

    if (small) {
      el.className = `mini-ball mini--${color}`;
    } else {
      el.className = `lotto-ball ball--${isBonus ? 'bonus' : color}`;
    }

    el.setAttribute('role', 'listitem');
    el.setAttribute('aria-label', `${isBonus ? '보너스 ' : ''}${num}번`);
    el.textContent = String(num);
    return el;
  }

  /**
   * 볼 행(row)을 렌더링해 컨테이너에 넣는다.
   * @param {HTMLElement} container  - 대상 컨테이너
   * @param {number[]}    numbers    - 당첨번호 배열
   * @param {number}      bonus      - 보너스 번호
   */
  function renderBallRow(container, numbers, bonus) {
    container.innerHTML = '';
    container.setAttribute('role', 'list');

    numbers.forEach(n => container.appendChild(createBallElement(n)));

    // + 구분자
    const sep = document.createElement('span');
    sep.className = 'ball-separator';
    sep.setAttribute('aria-label', '보너스 번호');
    sep.textContent = '+';
    container.appendChild(sep);

    container.appendChild(createBallElement(bonus, true));
  }

  /**
   * 미니 볼 행을 렌더링해 컨테이너에 넣는다.
   * @param {HTMLElement} container
   * @param {number[]}    numbers
   */
  function renderMiniBalls(container, numbers) {
    container.innerHTML = '';
    numbers.forEach(n => container.appendChild(createBallElement(n, false, true)));
  }


  // ─────────────────────────────────────────────────────────────
  // 4. 로딩 / 스켈레톤 상태
  // ─────────────────────────────────────────────────────────────

  /**
   * 특정 selector의 엘리먼트에 스켈레톤 클래스 토글
   * @param {string}  selector - CSS 선택자
   * @param {boolean} loading  - true = 스켈레톤 ON, false = OFF
   */
  function setLoadingState(selector, loading) {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.toggle('skeleton', loading);
      el.setAttribute('aria-busy', loading ? 'true' : 'false');
    });
  }

  /**
   * 특정 엘리먼트 내용을 로딩 플레이스홀더로 교체
   * @param {HTMLElement} el
   * @param {string}      [text='로딩 중…']
   */
  function showLoadingPlaceholder(el, text = '로딩 중…') {
    if (!el) return;
    el.classList.add('skeleton');
    el.setAttribute('aria-busy', 'true');
    el.dataset.originalText = el.textContent;
    el.textContent = text;
  }

  /**
   * 플레이스홀더를 해제하고 실제 콘텐츠를 표시
   * @param {HTMLElement} el
   * @param {string}      text - 표시할 텍스트
   */
  function hideLoadingPlaceholder(el, text) {
    if (!el) return;
    el.classList.remove('skeleton');
    el.removeAttribute('aria-busy');
    el.textContent = text !== undefined ? text : (el.dataset.originalText || '');
    delete el.dataset.originalText;
  }


  // ─────────────────────────────────────────────────────────────
  // 5. 토스트 알림
  // ─────────────────────────────────────────────────────────────

  /**
   * 토스트 알림 표시
   * @param {string}                           message
   * @param {'success'|'error'|'info'|'warn'}  [type='info']
   * @param {number}                           [duration=3000]
   */
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const iconMap = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = iconMap[type] ?? 'ℹ️';

    const msg = document.createElement('span');
    msg.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(msg);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }


  // ─────────────────────────────────────────────────────────────
  // 6. 클립보드
  // ─────────────────────────────────────────────────────────────

  /**
   * 텍스트를 클립보드에 복사
   * @param   {string} text
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // execCommand fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }


  // ─────────────────────────────────────────────────────────────
  // 7. 디바운스 / 스로틀
  // ─────────────────────────────────────────────────────────────

  /**
   * 디바운스: 마지막 호출 후 delay ms 뒤에 fn 실행
   * @param   {Function} fn
   * @param   {number}   delay
   * @returns {Function}
   */
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * 스로틀: delay ms 내 fn을 최대 1회 실행
   * @param   {Function} fn
   * @param   {number}   delay
   * @returns {Function}
   */
  function throttle(fn, delay) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  }


  // ─────────────────────────────────────────────────────────────
  // 8. 배열 / 수학 유틸
  // ─────────────────────────────────────────────────────────────

  /**
   * 배열을 N개씩 나누기
   * @param   {any[]}  arr
   * @param   {number} size
   * @returns {any[][]}
   */
  function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 빈도 맵을 내림/오름차순 정렬
   * @param   {Map<any,number>} freqMap
   * @param   {'desc'|'asc'}   [order='desc']
   * @returns {Array<[any,number]>}
   */
  function sortByFrequency(freqMap, order = 'desc') {
    return Array.from(freqMap.entries())
      .sort(([, a], [, b]) => order === 'desc' ? b - a : a - b);
  }

  /**
   * 값을 0~1 범위로 정규화 (히트맵 강도 계산용)
   * @param   {number} val
   * @param   {number} min
   * @param   {number} max
   * @returns {number}
   */
  function normalize(val, min, max) {
    if (max === min) return 0.5;
    return (val - min) / (max - min);
  }


  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  return {
    formatNumber,
    formatPrize,
    formatPercent,
    formatDate,
    formatDateShort,
    calcNextDrawDday,
    formatRelativeDate,
    getBallColor,
    createBallElement,
    renderBallRow,
    renderMiniBalls,
    setLoadingState,
    showLoadingPlaceholder,
    hideLoadingPlaceholder,
    showToast,
    copyToClipboard,
    debounce,
    throttle,
    chunkArray,
    sortByFrequency,
    normalize,
  };

})();
