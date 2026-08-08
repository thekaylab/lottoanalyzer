/**
 * storage.js  —  로또 데이터 로드 & 캐싱 모듈
 *
 * 전역 네임스페이스: window.LottoStorage
 * ES6 module 미사용 → file:// 프로토콜에서도 정상 동작
 *
 * 공개 API:
 *   LottoStorage.loadLottoData()          → Promise<LottoRound[]>
 *   LottoStorage.getLatestRound(data)     → LottoRound
 *   LottoStorage.getRoundData(data, round)→ LottoRound|undefined
 *   LottoStorage.clearMemCache()
 *   LottoStorage.savePrediction(sets)
 *   LottoStorage.loadSavedPredictions()   → Array
 *   LottoStorage.deleteSavedPrediction(id)
 *   LottoStorage.clearAllPredictions()
 *   LottoStorage.isStorageAvailable()     → boolean
 *
 * @namespace LottoStorage
 */
window.LottoStorage = (function () {

  // ─────────────────────────────────────────────────────────────
  // 1. 상수
  // ─────────────────────────────────────────────────────────────

  /** 로또 데이터 JSON 경로 */
  const DATA_PATH = './data/lotto.json';

  /** localStorage 키 */
  const STORAGE_KEYS = {
    CACHE:       'lotto-cache',
    PREDICTIONS: 'lotto-predictions',
    THEME:       'lotto-theme',
  };

  /** 캐시 버전: JSON을 업데이트할 때마다 올려 이전 캐시를 자동 무효화한다 */
  const CACHE_VERSION = '1.8';

  /** 캐시 유효 시간 (밀리초): 1시간 */
  const CACHE_TTL_MS = 60 * 60 * 1000;

  /** fetch 타임아웃 (밀리초) */
  const FETCH_TIMEOUT_MS = 10_000;

  /** 저장 예측 번호 최대 개수 */
  const MAX_SAVED_PREDICTIONS = 50;

  // ─────────────────────────────────────────────────────────────
  // 2. 메모리 캐시 / 상태
  // ─────────────────────────────────────────────────────────────

  /** @type {Array|null} 메모리 캐시 */
  let _memCache = null;

  /** @type {boolean} 로드 진행 중 여부 */
  let _loading = false;

  /** @type {Array<{resolve:Function,reject:Function}>} 대기 중인 콜백 */
  let _waiters = [];

  // ─────────────────────────────────────────────────────────────
  // 3. 핵심 API
  // ─────────────────────────────────────────────────────────────

  /**
   * 로또 회차 데이터를 비동기로 로드한다.
   *
   * 우선 순위: 메모리 캐시 → localStorage 캐시 → fetch
   *
   * @returns {Promise<Array>} 정규화된 데이터 배열 (최신 회차 먼저)
   */
  async function loadLottoData() {
    // ① 메모리 캐시 히트
    if (_memCache) return _memCache;

    // ② 이미 로드 중이면 대기
    if (_loading) {
      return new Promise((resolve, reject) => {
        _waiters.push({ resolve, reject });
      });
    }

    _loading = true;

    try {
      // ③ localStorage 유효 캐시 확인
      const persisted = _readPersistedCache();
      if (persisted) {
        _memCache = persisted;
        _notifyWaiters(persisted);
        return persisted;
      }

      // ④ 네트워크 fetch
      const raw  = await _fetchWithTimeout(DATA_PATH, FETCH_TIMEOUT_MS);
      const data = _normalizeData(raw);

      if (data.length === 0) {
        throw new Error('유효한 로또 데이터가 없습니다.');
      }

      // ⑤ 캐시 저장
      _memCache = data;
      // raw._last_updated를 캐시에 함께 저장해 다음번 비교
      _writePersistedCache(data, raw._last_updated || '');
      _notifyWaiters(data);
      return data;

    } catch (err) {
      _notifyWaitersError(err);
      throw err;

    } finally {
      _loading = false;
      _waiters = [];
    }
  }

  /**
   * 가장 최신 회차 데이터 반환
   * @param {Array} data
   * @returns {Object|null}
   */
  function getLatestRound(data) {
    if (!data || data.length === 0) return null;
    return data[0]; // 내림차순 정렬 보장
  }

  /**
   * 특정 회차 데이터 반환
   * @param {Array}  data
   * @param {number} round
   * @returns {Object|undefined}
   */
  function getRoundData(data, round) {
    return data.find(d => d.round === round);
  }

  /**
   * 메모리 캐시 강제 초기화
   */
  function clearMemCache() {
    _memCache = null;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. 내부: fetch 유틸
  // ─────────────────────────────────────────────────────────────

  /**
   * 타임아웃을 지원하는 fetch
   * @param   {string} url
   * @param   {number} ms
   * @returns {Promise<any>}
   */
  async function _fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), ms);

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${res.statusText || '알 수 없는 오류'}`);
      }

      return await res.json();

    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`데이터 로드 시간 초과 (${ms / 1000}초)`);
      }
      throw err;

    } finally {
      clearTimeout(tid);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. 내부: 데이터 정규화
  // ─────────────────────────────────────────────────────────────

  /**
   * 원시 JSON → 정규화된 회차 배열
   * 배열 직접 형식 또는 { data: [] } 형식 모두 지원
   * @param   {any} raw
   * @returns {Array}
   */
  function _normalizeData(raw) {
    const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);

    return arr
      .filter(item =>
        item &&
        typeof item.round === 'number' &&
        Array.isArray(item.numbers) &&
        item.numbers.length === 6 &&
        item.numbers.every(n => typeof n === 'number' && n >= 1 && n <= 45)
      )
      .map(item => ({
        round:   item.round,
        date:    typeof item.date === 'string' ? item.date : '',
        numbers: [...item.numbers].sort((a, b) => a - b),
        bonus:   typeof item.bonus === 'number' ? item.bonus : 0,
        prize:   item.prize ?? 0,
        winners: item.winners ?? 0,
        sales:   item.sales ?? 0,
      }))
      .sort((a, b) => b.round - a.round); // 최신 먼저
  }

  // ─────────────────────────────────────────────────────────────
  // 6. 내부: localStorage 영속 캐시
  // ─────────────────────────────────────────────────────────────

  function _readPersistedCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CACHE);
      if (!raw) return null;
      const { ts, ver, data } = JSON.parse(raw);

      // 버전 불일치 → 즉시 파기
      if (ver !== CACHE_VERSION) {
        localStorage.removeItem(STORAGE_KEYS.CACHE);
        return null;
      }
      // TTL 만료
      if (Date.now() - ts > CACHE_TTL_MS) {
        localStorage.removeItem(STORAGE_KEYS.CACHE);
        return null;
      }
      return _normalizeData({ data });
    } catch {
      return null;
    }
  }

  function _writePersistedCache(data, lastUpdated) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CACHE,
        JSON.stringify({ ts: Date.now(), ver: CACHE_VERSION, lastUpdated: lastUpdated || '', data })
      );
    } catch {
      // 저장 공간 부족 등은 무시
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7. 내부: 대기자 처리
  // ─────────────────────────────────────────────────────────────

  function _notifyWaiters(data) {
    _waiters.forEach(w => w.resolve(data));
  }

  function _notifyWaitersError(err) {
    _waiters.forEach(w => w.reject(err));
  }

  // ─────────────────────────────────────────────────────────────
  // 8. 사용자 저장 번호 CRUD
  // ─────────────────────────────────────────────────────────────

  /**
   * 예측 번호 세트 저장
   * @param {number[][]} sets
   */
  function savePrediction(sets) {
    const saved = loadSavedPredictions();
    saved.unshift({ id: Date.now(), savedAt: new Date().toISOString(), sets });
    if (saved.length > MAX_SAVED_PREDICTIONS) saved.splice(MAX_SAVED_PREDICTIONS);
    _writePredictions(saved);
  }

  /**
   * 저장된 예측 번호 전체 로드
   * @returns {Array}
   */
  function loadSavedPredictions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PREDICTIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * 특정 예측 삭제
   * @param {number} id
   */
  function deleteSavedPrediction(id) {
    _writePredictions(loadSavedPredictions().filter(p => p.id !== id));
  }

  /** 모든 예측 삭제 */
  function clearAllPredictions() {
    localStorage.removeItem(STORAGE_KEYS.PREDICTIONS);
  }

  function _writePredictions(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.PREDICTIONS, JSON.stringify(list));
    } catch (err) {
      console.error('[LottoStorage] 예측 저장 실패:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 9. 기타
  // ─────────────────────────────────────────────────────────────

  /**
   * localStorage 사용 가능 여부
   * @returns {boolean}
   */
  function isStorageAvailable() {
    try {
      const k = '__lotto_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────────────────
  return {
    loadLottoData,
    getLatestRound,
    getRoundData,
    clearMemCache,
    savePrediction,
    loadSavedPredictions,
    deleteSavedPrediction,
    clearAllPredictions,
    isStorageAvailable,
  };

})();
