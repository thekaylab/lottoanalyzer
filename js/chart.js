/**
 * chart.js  —  Chart.js 기반 데이터 시각화 모듈
 *
 * 전역 네임스페이스: window.LottoChart
 * 의존: Chart.js (CDN), window.LottoAnalysis
 *
 * ═══════════════════════════════════════════════════════════════
 * 차트 목록
 * ═══════════════════════════════════════════════════════════════
 *  1. renderFreqChart(data, canvasId, limit)      번호별 출현횟수
 *  2. renderRecentChart(data, canvasId)           최근 출현 빈도 비교 (10/30/50회)
 *  3. renderOddEvenChart(data, canvasId, limit)   홀짝 비율
 *  4. renderSumChart(data, canvasId, limit)       번호 합계 분포
 *  5. renderRangeChart(data, canvasId, limit)     구간별 분포
 *  6. renderDigitChart(data, canvasId, limit)     끝수 분포
 *  7. renderTrendChart(data, canvasId)            최근 회차 추이
 *
 *  initAllCharts(data, limit)  → 통계 페이지 전체 초기화
 *  initHomeChart(data, limit)  → 홈 카드 6 초기화
 *  updateAllCharts(data, limit) → 범위 변경 시 전체 갱신
 *
 * ═══════════════════════════════════════════════════════════════
 * @namespace LottoChart
 */
window.LottoChart = (function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 1. 색상 팔레트 & 테마 헬퍼
  // ─────────────────────────────────────────────────────────────

  /**
   * 로또 번호 구간별 색상 (볼 컬러와 동일)
   * 1~10 노랑 / 11~20 파랑 / 21~30 빨강 / 31~40 회색 / 41~45 초록
   */
  var BALL_COLORS = {
    yellow: '#f5c518',
    blue:   '#3b82f6',
    red:    '#ef4444',
    gray:   '#94a3b8',
    green:  '#22c55e',
  };

  /** 번호 → 구간 색상 */
  function _ballColor(n) {
    if (n <= 10) return BALL_COLORS.yellow;
    if (n <= 20) return BALL_COLORS.blue;
    if (n <= 30) return BALL_COLORS.red;
    if (n <= 40) return BALL_COLORS.gray;
    return BALL_COLORS.green;
  }

  /** 현재 테마(다크/라이트)에 맞는 색상 반환 */
  function _theme() {
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      text:       dark ? '#cbd5e1' : '#334155',
      textMuted:  dark ? '#64748b' : '#94a3b8',
      grid:       dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
      tooltip:    dark ? '#1e293b' : '#ffffff',
      tooltipBdr: dark ? '#334155' : '#e2e8f0',
    };
  }

  /** 16진수 색상에 투명도를 추가해 rgba로 변환 */
  function _alpha(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /** 7가지 다채로운 파스텔톤 배열 (도넛 / 끝수 / 구간 차트용) */
  var PALETTE = [
    '#a855f7', '#3b82f6', '#22c55e', '#f59e0b',
    '#ef4444', '#06b6d4', '#ec4899', '#f97316',
    '#14b8a6', '#8b5cf6',
  ];


  // ─────────────────────────────────────────────────────────────
  // 2. Chart.js 공통 기본 옵션
  // ─────────────────────────────────────────────────────────────

  /**
   * 막대/라인 차트 공통 기본 옵션을 반환한다.
   * 호출 시점의 테마를 반영하므로 매 렌더링마다 호출해야 한다.
   */
  function _baseOptions() {
    var t = _theme();
    return {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          labels: {
            color:    t.text,
            font:     { family: "'Inter', sans-serif", size: 12 },
            padding:  12,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          backgroundColor: t.tooltip,
          borderColor:     t.tooltipBdr,
          borderWidth:     1,
          titleColor:      t.text,
          bodyColor:       t.text,
          padding:         10,
          cornerRadius:    8,
        },
      },
      scales: {
        x: {
          ticks: {
            color: t.textMuted,
            font:  { family: "'Inter', sans-serif", size: 11 },
            maxRotation: 0,
          },
          grid: { color: t.grid },
        },
        y: {
          ticks: {
            color: t.textMuted,
            font:  { family: "'Inter', sans-serif", size: 11 },
          },
          grid: { color: t.grid },
        },
      },
    };
  }


  // ─────────────────────────────────────────────────────────────
  // 3. 인스턴스 레지스트리 (destroy 관리)
  // ─────────────────────────────────────────────────────────────

  /** @type {Object<string, Chart>} canvasId → Chart 인스턴스 */
  var _registry = {};

  /**
   * 기존 차트를 파괴하고 새 Chart 인스턴스를 등록한다.
   * @param   {string} id      canvas 엘리먼트 ID
   * @param   {Object} config  Chart.js 설정 객체
   * @returns {Chart|null}
   */
  function _create(id, config) {
    var canvas = document.getElementById(id);
    if (!canvas) {
      console.warn('[LottoChart] canvas#' + id + ' 를 찾을 수 없습니다.');
      return null;
    }

    // 이전 인스턴스 파괴
    if (_registry[id]) {
      _registry[id].destroy();
      delete _registry[id];
    }

    var chart = new Chart(canvas, config);
    _registry[id] = chart;
    return chart;
  }


  // ─────────────────────────────────────────────────────────────
  // 4. 분석 헬퍼 (LottoAnalysis 폴백 포함)
  // ─────────────────────────────────────────────────────────────

  var ALL_NUMBERS = Array.from({ length: 45 }, function (_, i) { return i + 1; });

  /** LottoAnalysis.calcFrequency 폴백 */
  function _freq(data, limit) {
    if (window.LottoAnalysis) return window.LottoAnalysis.calcFrequency(data, limit || 0);
    var slice = (limit > 0) ? data.slice(0, limit) : data;
    var map   = new Map(ALL_NUMBERS.map(function (n) { return [n, 0]; }));
    slice.forEach(function (r) {
      r.numbers.forEach(function (n) { map.set(n, (map.get(n) || 0) + 1); });
    });
    return map;
  }

  /** 슬라이스 헬퍼 */
  function _slice(data, limit) {
    return (limit > 0) ? data.slice(0, limit) : data;
  }


  // ─────────────────────────────────────────────────────────────
  // 5. 차트 1: 번호별 출현횟수
  // ─────────────────────────────────────────────────────────────

  /**
   * 번호 1~45의 출현 횟수를 막대 차트로 표시한다.
   * 구간별로 볼 컬러를 적용해 직관적으로 구분한다.
   *
   * @param {Object[]} data     회차 데이터
   * @param {string}   canvasId canvas 엘리먼트 ID
   * @param {number}   [limit=0] 최근 N회 (0=전체)
   */
  function renderFreqChart(data, canvasId, limit) {
    limit = limit || 0;
    var freqMap = _freq(data, limit);
    var labels  = ALL_NUMBERS.map(String);
    var values  = ALL_NUMBERS.map(function (n) { return freqMap.get(n) || 0; });
    var colors  = ALL_NUMBERS.map(_ballColor);
    var t       = _theme();

    var opts = _baseOptions();
    opts.plugins.legend.display = false;
    opts.scales.x.ticks.font    = { family: "'Inter', sans-serif", size: 9 };
    opts.plugins.tooltip.callbacks = {
      title: function (items) { return items[0].label + '번'; },
      label: function (item)  { return '출현: ' + item.raw + '회'; },
    };

    _create(canvasId, {
      type: 'bar',
      data: {
        labels:   labels,
        datasets: [{
          label:            '출현 횟수',
          data:             values,
          backgroundColor:  colors.map(function (c) { return _alpha(c, 0.85); }),
          borderColor:      colors,
          borderWidth:      1,
          borderRadius:     3,
          borderSkipped:    false,
        }],
      },
      options: opts,
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 6. 차트 2: 최근 출현 빈도 비교 (10 / 30 / 50회)
  // ─────────────────────────────────────────────────────────────

  /**
   * 최근 10·30·50회 출현 빈도를 멀티 라인 차트로 비교한다.
   * 1~45 전체보다 번호간 추세 패턴을 파악하기 좋다.
   *
   * @param {Object[]} data
   * @param {string}   canvasId
   */
  function renderRecentChart(data, canvasId) {
    var f10  = _freq(data, 10);
    var f30  = _freq(data, 30);
    var f50  = _freq(data, 50);
    var labels = ALL_NUMBERS.map(String);

    var opts = _baseOptions();
    opts.plugins.tooltip.callbacks = {
      title: function (items) { return items[0].label + '번'; },
    };
    opts.scales.x.ticks.font = { family: "'Inter', sans-serif", size: 9 };
    opts.elements = {
      point: { radius: 2, hoverRadius: 5 },
      line:  { tension: 0.3 },
    };

    _create(canvasId, {
      type: 'line',
      data: {
        labels:   labels,
        datasets: [
          {
            label:           '최근 50회',
            data:            ALL_NUMBERS.map(function (n) { return f50.get(n) || 0; }),
            borderColor:     '#3b82f6',
            backgroundColor: _alpha('#3b82f6', 0.08),
            fill:            true,
            borderWidth:     1.5,
          },
          {
            label:           '최근 30회',
            data:            ALL_NUMBERS.map(function (n) { return f30.get(n) || 0; }),
            borderColor:     '#a855f7',
            backgroundColor: _alpha('#a855f7', 0.08),
            fill:            true,
            borderWidth:     1.5,
          },
          {
            label:           '최근 10회',
            data:            ALL_NUMBERS.map(function (n) { return f10.get(n) || 0; }),
            borderColor:     '#f59e0b',
            backgroundColor: _alpha('#f59e0b', 0.15),
            fill:            true,
            borderWidth:     2,
          },
        ],
      },
      options: opts,
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 7. 차트 3: 홀짝 비율 (도넛 + 분포 막대)
  // ─────────────────────────────────────────────────────────────

  /**
   * 홀짝 비율을 도넛 차트로 시각화한다.
   * 도넛 중앙에 가장 빈도 높은 비율 텍스트를 표시한다.
   * 옆의 #chart-odd-even-legend div에 비율 분포 목록을 렌더링한다.
   *
   * @param {Object[]} data
   * @param {string}   canvasId
   * @param {number}   [limit=0]
   */
  function renderOddEvenChart(data, canvasId, limit) {
    limit = limit || 0;
    var A = window.LottoAnalysis;
    var stats = A
      ? A.calcOddEvenStats(data, limit)
      : _calcOddEvenFallback(data, limit);

    // 도넛: 홀수 평균 vs 짝수 평균
    var avgOdd  = stats.avgOdd;
    var avgEven = stats.avgEven;

    // 중앙 텍스트 플러그인
    var centerText = {
      id: 'centerText_' + canvasId,
      afterDraw: function (chart) {
        var ctx = chart.ctx;
        var cx  = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
        var cy  = chart.chartArea.top  + (chart.chartArea.bottom - chart.chartArea.top) / 2;
        ctx.save();
        ctx.font         = 'bold 18px Inter,sans-serif';
        ctx.fillStyle    = _theme().text;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(avgOdd * 10) / 10 + ':' + Math.round(avgEven * 10) / 10, cx, cy - 8);
        ctx.font      = '12px Inter,sans-serif';
        ctx.fillStyle = _theme().textMuted;
        ctx.fillText('평균 홀:짝', cx, cy + 14);
        ctx.restore();
      },
    };

    _create(canvasId, {
      type:    'doughnut',
      data: {
        labels:   ['홀수', '짝수'],
        datasets: [{
          data:            [avgOdd, avgEven],
          backgroundColor: [_alpha('#a855f7', 0.85), _alpha('#3b82f6', 0.85)],
          borderColor:     ['#a855f7', '#3b82f6'],
          borderWidth:     2,
          hoverOffset:     6,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '68%',
        animation:           { duration: 600 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color:         _theme().text,
              font:          { family: "'Inter', sans-serif", size: 12 },
              padding:       16,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.label + ': 평균 ' + Math.round(item.raw * 100) / 100 + '개';
              },
            },
          },
        },
      },
      plugins: [centerText],
    });

    // 옆 범례: 비율 분포 목록
    _renderOddEvenLegend(stats);
  }

  /** 홀짝 분포 범례 렌더링 */
  function _renderOddEvenLegend(stats) {
    var el = document.getElementById('chart-odd-even-legend');
    if (!el) return;

    // distribution Map을 정렬
    var entries = [];
    stats.distribution.forEach(function (count, ratio) {
      entries.push({ ratio: ratio, count: count });
    });
    entries.sort(function (a, b) { return b.count - a.count; });

    var total = stats.totalRounds;
    var html  = '<ul class="oe-legend-list">';
    entries.forEach(function (e) {
      var pct = total > 0 ? Math.round((e.count / total) * 100) : 0;
      html += '<li class="oe-legend-item">'
        + '<span class="oe-ratio-label">' + e.ratio + '</span>'
        + '<div class="oe-bar-track"><div class="oe-bar-fill" style="width:' + pct + '%"></div></div>'
        + '<span class="oe-pct">' + pct + '%</span>'
        + '<span class="oe-count">(' + e.count + '회)</span>'
        + '</li>';
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  /** 홀짝 폴백 계산 */
  function _calcOddEvenFallback(data, limit) {
    var slice = _slice(data, limit);
    var dist  = new Map();
    var oddSum = 0;
    slice.forEach(function (r) {
      var odd  = r.numbers.filter(function (n) { return n % 2 !== 0; }).length;
      var even = 6 - odd;
      var key  = odd + ':' + even;
      dist.set(key, (dist.get(key) || 0) + 1);
      oddSum += odd;
    });
    return {
      distribution: dist,
      avgOdd:       slice.length > 0 ? Math.round((oddSum / slice.length) * 100) / 100 : 0,
      avgEven:      slice.length > 0 ? Math.round(((6 * slice.length - oddSum) / slice.length) * 100) / 100 : 0,
      totalRounds:  slice.length,
    };
  }


  // ─────────────────────────────────────────────────────────────
  // 8. 차트 4: 번호 합계 분포 (히스토그램)
  // ─────────────────────────────────────────────────────────────

  /**
   * 회차별 번호 합계의 분포를 20단위 구간 히스토그램으로 표시한다.
   * 이론적 범위 21~255 중 실제 데이터 범위만 표시한다.
   *
   * @param {Object[]} data
   * @param {string}   canvasId
   * @param {number}   [limit=0]
   */
  function renderSumChart(data, canvasId, limit) {
    limit = limit || 0;
    var slice = _slice(data, limit);

    // 20 단위 구간으로 히스토그램 빈도 계산
    var STEP    = 20;
    var BIN_MIN = 60;
    var BIN_MAX = 260;
    var bins    = {};

    for (var b = BIN_MIN; b < BIN_MAX; b += STEP) {
      bins[b] = 0;
    }

    slice.forEach(function (r) {
      var s   = r.numbers.reduce(function (a, x) { return a + x; }, 0);
      var key = Math.floor(s / STEP) * STEP;
      if (key < BIN_MIN) key = BIN_MIN;
      if (key >= BIN_MAX) key = BIN_MAX - STEP;
      bins[key] = (bins[key] || 0) + 1;
    });

    var labels = Object.keys(bins).map(function (k) {
      return k + '~' + (parseInt(k) + STEP - 1);
    });
    var values = Object.keys(bins).map(function (k) { return bins[k]; });

    // 100~180 구간 강조 (통계적으로 가장 빈번한 범위)
    var bgColors = Object.keys(bins).map(function (k) {
      var kn = parseInt(k);
      return (kn >= 100 && kn < 180) ? _alpha('#a855f7', 0.85) : _alpha('#64748b', 0.5);
    });

    var opts = _baseOptions();
    opts.plugins.legend.display = false;
    opts.plugins.tooltip.callbacks = {
      title: function (items) { return '합계 ' + items[0].label; },
      label: function (item)  { return '발생: ' + item.raw + '회'; },
    };

    _create(canvasId, {
      type: 'bar',
      data: {
        labels:   labels,
        datasets: [{
          label:           '발생 횟수',
          data:            values,
          backgroundColor: bgColors,
          borderRadius:    4,
          borderSkipped:   false,
        }],
      },
      options: opts,
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 9. 차트 5: 구간별 분포
  // ─────────────────────────────────────────────────────────────

  /**
   * 5구간(1~9 / 10~19 / 20~29 / 30~39 / 40~45)의 누적 출현을
   * 수평 막대 차트로 표시한다.
   *
   * @param {Object[]} data
   * @param {string}   canvasId
   * @param {number}   [limit=0]
   */
  function renderRangeChart(data, canvasId, limit) {
    limit = limit || 0;
    var RANGES = [
      { label: '1 ~ 9',   min: 1,  max: 9,  color: BALL_COLORS.yellow },
      { label: '10 ~ 19', min: 10, max: 19, color: BALL_COLORS.blue   },
      { label: '20 ~ 29', min: 20, max: 29, color: BALL_COLORS.red    },
      { label: '30 ~ 39', min: 30, max: 39, color: BALL_COLORS.gray   },
      { label: '40 ~ 45', min: 40, max: 45, color: BALL_COLORS.green  },
    ];

    var slice  = _slice(data, limit);
    var totals = RANGES.map(function () { return 0; });

    slice.forEach(function (r) {
      r.numbers.forEach(function (n) {
        for (var i = 0; i < RANGES.length; i++) {
          if (n >= RANGES[i].min && n <= RANGES[i].max) {
            totals[i]++;
            break;
          }
        }
      });
    });

    var opts = _baseOptions();
    opts.indexAxis = 'y';  // 수평 막대
    opts.plugins.legend.display = false;
    opts.plugins.tooltip.callbacks = {
      label: function (item) {
        var total = totals.reduce(function (a, b) { return a + b; }, 0) || 1;
        var pct   = Math.round((item.raw / total) * 100);
        return item.raw + '개 (' + pct + '%)';
      },
    };
    opts.scales.x.ticks.stepSize = 1;

    _create(canvasId, {
      type: 'bar',
      data: {
        labels:   RANGES.map(function (r) { return r.label; }),
        datasets: [{
          label:           '출현 횟수',
          data:            totals,
          backgroundColor: RANGES.map(function (r) { return _alpha(r.color, 0.8); }),
          borderColor:     RANGES.map(function (r) { return r.color; }),
          borderWidth:     2,
          borderRadius:    4,
          borderSkipped:   false,
        }],
      },
      options: opts,
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 10. 차트 6: 끝수 분포 (0~9)
  // ─────────────────────────────────────────────────────────────

  /**
   * 단위 자리(끝수) 0~9의 누적 출현 횟수를 막대 차트로 표시한다.
   *
   * @param {Object[]} data
   * @param {string}   canvasId
   * @param {number}   [limit=0]
   */
  function renderDigitChart(data, canvasId, limit) {
    limit = limit || 0;
    var A     = window.LottoAnalysis;
    var dist  = A
      ? A.calcLastDigitStats(data, limit)
      : _calcDigitFallback(data, limit);

    var labels = ['0끝', '1끝', '2끝', '3끝', '4끝', '5끝', '6끝', '7끝', '8끝', '9끝'];
    var values = Array.from({ length: 10 }, function (_, i) { return dist.get(i) || 0; });
    var maxVal = Math.max.apply(null, values) || 1;

    var opts = _baseOptions();
    opts.plugins.legend.display = false;
    opts.plugins.tooltip.callbacks = {
      title: function (items) { return '끝수 ' + items[0].dataIndex; },
      label: function (item)  { return '출현: ' + item.raw + '회'; },
    };

    _create(canvasId, {
      type: 'bar',
      data: {
        labels:   labels,
        datasets: [{
          label:           '출현 횟수',
          data:            values,
          backgroundColor: values.map(function (v) {
            var intensity = v / maxVal;
            return _alpha(PALETTE[0], 0.3 + intensity * 0.6);
          }),
          borderColor:    PALETTE[0],
          borderWidth:    2,
          borderRadius:   5,
          borderSkipped:  false,
        }],
      },
      options: opts,
    });
  }

  /** 끝수 폴백 계산 */
  function _calcDigitFallback(data, limit) {
    var slice = _slice(data, limit);
    var dist  = new Map(Array.from({ length: 10 }, function (_, i) { return [i, 0]; }));
    slice.forEach(function (r) {
      r.numbers.forEach(function (n) {
        var d = n % 10;
        dist.set(d, (dist.get(d) || 0) + 1);
      });
    });
    return dist;
  }


  // ─────────────────────────────────────────────────────────────
  // 11. 차트 7: 최근 회차 추이 (합계 / 홀수개수 / AC값)
  // ─────────────────────────────────────────────────────────────

  /**
   * 최근 20회 회차별 합계·홀수개수·AC값의 추이를 멀티 라인으로 표시한다.
   * Y축이 각각 다른 스케일을 가지므로 이중 Y축을 사용한다.
   *
   * @param {Object[]} data
   * @param {string}   canvasId
   */
  function renderTrendChart(data, canvasId) {
    // 최근 20회 (오래된 것이 왼쪽)
    var TREND_COUNT = 20;
    var slice       = data.slice(0, TREND_COUNT).reverse(); // 오름차순
    var A           = window.LottoAnalysis;

    var labels    = slice.map(function (r) { return r.round + '회'; });
    var sums      = slice.map(function (r) { return r.numbers.reduce(function (a, b) { return a + b; }, 0); });
    var oddCounts = slice.map(function (r) { return r.numbers.filter(function (n) { return n % 2 !== 0; }).length; });
    var acVals    = slice.map(function (r) {
      if (A) return A.calcAC(r.numbers).ac;
      return _calcACFallback(r.numbers);
    });

    var opts = _baseOptions();
    opts.plugins.tooltip.mode = 'index';
    opts.plugins.tooltip.intersect = false;
    opts.elements = {
      point: { radius: 3, hoverRadius: 6 },
      line:  { tension: 0.35 },
    };
    // 이중 Y축
    opts.scales.y = {
      type:     'linear',
      position: 'left',
      title:    { display: true, text: '합계', color: '#3b82f6', font: { size: 11 } },
      ticks:    { color: _theme().textMuted, font: { size: 10 } },
      grid:     { color: _theme().grid },
    };
    opts.scales.y2 = {
      type:      'linear',
      position:  'right',
      title:     { display: true, text: '홀수 / AC', color: '#a855f7', font: { size: 11 } },
      min:       0,
      max:       10,
      ticks:     { color: _theme().textMuted, font: { size: 10 }, stepSize: 1 },
      grid:      { drawOnChartArea: false },
    };
    opts.scales.x.ticks.maxRotation = 45;

    _create(canvasId, {
      type: 'line',
      data: {
        labels:   labels,
        datasets: [
          {
            label:           '합계',
            data:            sums,
            borderColor:     '#3b82f6',
            backgroundColor: _alpha('#3b82f6', 0.08),
            fill:            true,
            borderWidth:     2,
            yAxisID:         'y',
          },
          {
            label:       '홀수 개수',
            data:        oddCounts,
            borderColor: '#a855f7',
            borderWidth: 2,
            borderDash:  [4, 4],
            fill:        false,
            yAxisID:     'y2',
          },
          {
            label:       'AC값',
            data:        acVals,
            borderColor: '#22c55e',
            borderWidth: 2,
            borderDash:  [2, 2],
            fill:        false,
            yAxisID:     'y2',
          },
        ],
      },
      options: opts,
    });
  }

  /** AC값 폴백 계산 */
  function _calcACFallback(numbers) {
    var sorted = numbers.slice().sort(function (a, b) { return a - b; });
    var diffs  = new Set();
    for (var i = 0; i < sorted.length - 1; i++) {
      for (var j = i + 1; j < sorted.length; j++) {
        diffs.add(sorted[j] - sorted[i]);
      }
    }
    return diffs.size - (sorted.length - 1);
  }


  // ─────────────────────────────────────────────────────────────
  // 12. 홈 카드 6: 번호별 출현빈도 (범위 탭 포함)
  // ─────────────────────────────────────────────────────────────

  /** 홈 페이지 빈도 차트 현재 데이터 캐시 */
  var _homeData = null;

  /**
   * 홈 카드 6 차트를 초기화하고 범위 탭 이벤트를 연결한다.
   * @param {Object[]} data
   * @param {number}   [limit=0]
   */
  function initHomeChart(data, limit) {
    _homeData = data;
    renderFreqChart(data, 'chart-home-freq', limit || 0);

    // 범위 탭 이벤트 연결
    var tabs = document.querySelectorAll('.chart-range-tabs .range-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var range = tab.dataset.range;
        var l     = (range === 'all') ? 0 : parseInt(range, 10);
        if (_homeData) renderFreqChart(_homeData, 'chart-home-freq', l);
      });
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 13. 통계 페이지: 전체 차트 초기화 및 범위 갱신
  // ─────────────────────────────────────────────────────────────

  /**
   * 통계 페이지의 7개 차트를 모두 초기화한다.
   * @param {Object[]} data
   * @param {number}   [limit=0]
   */
  function initAllCharts(data, limit) {
    limit = limit || 0;
    renderFreqChart(   data, 'chart-freq',     limit);
    renderRecentChart( data, 'chart-recent'          );  // 항상 10/30/50 비교
    renderOddEvenChart(data, 'chart-odd-even', limit);
    renderSumChart(    data, 'chart-sum',      limit);
    renderRangeChart(  data, 'chart-range',    limit);
    renderDigitChart(  data, 'chart-digit',    limit);
    renderTrendChart(  data, 'chart-trend'           );  // 항상 최근 20회
  }

  /**
   * 통계 페이지 범위 변경 시 모든 차트를 갱신한다.
   * @param {Object[]} data
   * @param {number}   limit
   */
  function updateAllCharts(data, limit) {
    initAllCharts(data, limit);
  }

  /**
   * 테마 변경 시 모든 차트를 재렌더링한다.
   * (Chart.js의 색상은 렌더링 시점에 결정되므로 재생성이 필요)
   * @param {Object[]} data
   * @param {number}   [limit=0]
   */
  function refreshTheme(data, limit) {
    limit = limit || 0;
    if (document.getElementById('chart-freq')) initAllCharts(data, limit);
    if (document.getElementById('chart-home-freq') && _homeData) {
      renderFreqChart(_homeData, 'chart-home-freq', limit);
    }
  }

  /**
   * 모든 차트 인스턴스를 파괴한다.
   */
  function destroyAll() {
    Object.keys(_registry).forEach(function (id) {
      _registry[id].destroy();
      delete _registry[id];
    });
  }


  // ─────────────────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────────────────
  return {
    renderFreqChart:    renderFreqChart,
    renderRecentChart:  renderRecentChart,
    renderOddEvenChart: renderOddEvenChart,
    renderSumChart:     renderSumChart,
    renderRangeChart:   renderRangeChart,
    renderDigitChart:   renderDigitChart,
    renderTrendChart:   renderTrendChart,
    initHomeChart:      initHomeChart,
    initAllCharts:      initAllCharts,
    updateAllCharts:    updateAllCharts,
    refreshTheme:       refreshTheme,
    destroyAll:         destroyAll,
  };

})();
