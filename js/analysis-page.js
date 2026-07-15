/**
 * analysis-page.js  —  번호분석 페이지 컨트롤러
 *
 * 전역 네임스페이스: window.LottoAnalysisPage
 * 의존: window.LottoAnalysis, window.LottoUtils
 */
window.LottoAnalysisPage = (function () {
  'use strict';

  var _data = null;
  var _range = 0; // 0=전체, 50, 30, 10

  /**
   * 번호분석 페이지 초기화
   * @param {Object[]} data - 전체 로또 당첨 데이터
   */
  function init(data) {
    _data = data || [];
    _bindEvents();
    _updateAnalysis();
  }

  function _bindEvents() {
    var btns = document.querySelectorAll('.analysis-range-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _range = parseInt(btn.dataset.range, 10) || 0;
        _updateAnalysis();
      });
    });
  }

  function _updateAnalysis() {
    if (!_data || _data.length === 0) return;

    var limitData = _range > 0 ? _data.slice(0, _range) : _data;
    var Analysis  = window.LottoAnalysis;
    var Utils     = window.LottoUtils;

    if (!Analysis || !Utils) return;

    // 1. 기본 통계 지표 계산
    var allNumbers = [];
    limitData.forEach(function (round) {
      allNumbers = allNumbers.concat(round.numbers);
    });

    // 평균 합계 계산
    var sumTotal = limitData.reduce(function (acc, cur) {
      return acc + cur.numbers.reduce(function (a, b) { return a + b; }, 0);
    }, 0);
    var avgSum = limitData.length > 0 ? (sumTotal / limitData.length) : 0;

    // 평균값 (단일 번호 전체의 평균)
    var numSum = allNumbers.reduce(function (a, b) { return a + b; }, 0);
    var meanVal = allNumbers.length > 0 ? (numSum / allNumbers.length) : 0;

    // 중앙값 (단일 번호 정렬 시 중앙)
    var sortedNums = allNumbers.slice().sort(function (a, b) { return a - b; });
    var medianVal = 0;
    if (sortedNums.length > 0) {
      var mid = Math.floor(sortedNums.length / 2);
      medianVal = sortedNums.length % 2 !== 0 ? sortedNums[mid] : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
    }

    _setText('an-stat-mean', meanVal.toFixed(1));
    _setText('an-stat-median', medianVal.toFixed(1));
    _setText('an-stat-sum-avg', avgSum.toFixed(1));

    // 2. 미출현 번호 분석
    // limitData 기준 미출현 번호
    var missing = Analysis.calcMissingNumbers(_data, _range > 0 ? _range : undefined);
    _setText('an-missing-badge', missing.length + '개');

    var missingListContainer = document.getElementById('an-missing-list');
    if (missingListContainer) {
      missingListContainer.innerHTML = '';
      if (missing.length === 0) {
        missingListContainer.innerHTML = '<span class="empty-msg">최근 미출현 번호가 없습니다.</span>';
      } else {
        missing.forEach(function (n) {
          var ball = Utils.createBallElement(n);
          missingListContainer.appendChild(ball);
        });
      }
    }

    // 최장 미출현 번호
    var longestList = Analysis.calcLongestAbsent(_data); // [{number, absentFor, lastRound}, ...]
    var longestEl = document.getElementById('an-longest-absent');
    if (longestEl && longestList && longestList.length > 0) {
      // 가장 오래 안 나온 번호 상위 3개 표시
      var top3 = longestList.slice(0, 3).map(function (item) {
        return item.number + '번(' + item.absentFor + '주)';
      });
      longestEl.textContent = top3.join(', ');
    }

    // 3. 홀짝 & 저고 상세 비율
    // 전체 다중 회차 누적 비율 계산
    var oddEvenStats = Analysis.calcOddEvenStats(_data, _range > 0 ? _range : undefined); // {odd, even, total}
    if (oddEvenStats) {
      var oddPct = oddEvenStats.total > 0 ? (oddEvenStats.odd / oddEvenStats.total) * 100 : 50;
      var oddBar = document.getElementById('an-ratio-odd-bar');
      if (oddBar) oddBar.style.width = oddPct.toFixed(1) + '%';
      _setText('an-ratio-odd-txt', '홀수 ' + oddPct.toFixed(1) + '%');
      _setText('an-ratio-even-txt', '짝수 ' + (100 - oddPct).toFixed(1) + '%');
    }

    var lowHighStats = Analysis.calcLowHighStats(_data, _range > 0 ? _range : undefined); // {low, high, total}
    if (lowHighStats) {
      var lowPct = lowHighStats.total > 0 ? (lowHighStats.low / lowHighStats.total) * 100 : 50;
      var lowBar = document.getElementById('an-ratio-low-bar');
      if (lowBar) lowBar.style.width = lowPct.toFixed(1) + '%';
      _setText('an-ratio-low-txt', '저번호 ' + lowPct.toFixed(1) + '%');
      _setText('an-ratio-high-txt', '고번호 ' + (100 - lowPct).toFixed(1) + '%');
    }

    // 4. 고급 패턴 분석 (AC값 & 연속번호 & 동일 끝수)
    var acStats = Analysis.calcACStats(_data, _range > 0 ? _range : undefined);
    if (acStats) {
      _setText('an-pattern-ac', acStats.avg.toFixed(2));
    }

    var consecutiveStats = Analysis.calcConsecutiveStats(_data, _range > 0 ? _range : undefined);
    if (consecutiveStats) {
      // 비율을 퍼센트로 환산하여 표시 (예: 55.2%)
      var pct = consecutiveStats.consecutiveRate * 100;
      _setText('an-pattern-consecutive', pct.toFixed(1) + '% (' + consecutiveStats.avgPairCount + '쌍/회)');
    }

    var sameDigitStats = Analysis.calcSameLastDigitStats(_data, _range > 0 ? _range : undefined);
    if (sameDigitStats) {
      var pct = sameDigitStats.duplicateRate * 100;
      _setText('an-pattern-same-digit', pct.toFixed(1) + '%');
    }
  }

  function _setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  return {
    init: init
  };

})();
