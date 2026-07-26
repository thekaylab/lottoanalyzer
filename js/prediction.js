/**
 * prediction.js  —  로또 번호 추천 모듈 (v2 — 고정/제외 옵션 지원)
 *
 * 전역 네임스페이스: window.LottoPrediction
 * 의존: window.LottoAnalysis (선택적)
 *
 * ═══════════════════════════════════════════════════════════════
 * 옵션 파라미터 (모든 public 함수 공통)
 * ═══════════════════════════════════════════════════════════════
 *  options = {
 *    pinned:   number[]  반드시 포함할 번호 (기본: [])
 *    excluded: number[]  절대 포함하지 않을 번호 (기본: [])
 *    count:    number    생성 세트 수 (기본: 5)
 *  }
 *
 * ⚠️ 이 모듈은 통계적 패턴을 분석한 참고용 번호만 제공합니다.
 *    실제 당첨 예측이나 당첨 보장과는 무관합니다.
 *
 * @namespace LottoPrediction
 */
window.LottoPrediction = (function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 1. 상수
  // ─────────────────────────────────────────────────────────────

  var ALL_NUMBERS = Array.from({ length: 45 }, function (_, i) { return i + 1; });
  var SETS_COUNT  = 5;
  var LOW_HIGH_BOUNDARY = 22;
  var RANGES = [
    { label: '1구간(1~9)',   min: 1,  max: 9  },
    { label: '2구간(10~19)', min: 10, max: 19 },
    { label: '3구간(20~29)', min: 20, max: 29 },
    { label: '4구간(30~39)', min: 30, max: 39 },
    { label: '5구간(40~45)', min: 40, max: 45 },
  ];
  var DISCLAIMER = '⚠️ 이 번호는 역대 당첨 데이터의 통계적 패턴을 참고한 추천 번호입니다. '
    + '실제 당첨을 예측하거나 보장하지 않습니다. '
    + '로또는 확률 게임으로, 모든 번호 조합의 당첨 확률은 동일합니다 (1/8,145,060).';


  // ─────────────────────────────────────────────────────────────
  // 2. 옵션 정규화 헬퍼
  // ─────────────────────────────────────────────────────────────

  /**
   * options 파라미터를 정규화해 기본값을 채운다.
   * @param   {Object|undefined} opts
   * @returns {{ pinned: number[], excluded: number[], count: number }}
   */
  function _resolveOptions(opts) {
    return {
      pinned:   (opts && Array.isArray(opts.pinned))   ? opts.pinned   : [],
      excluded: (opts && Array.isArray(opts.excluded)) ? opts.excluded : [],
      count:    (opts && typeof opts.count === 'number' && opts.count > 0)
                  ? opts.count : SETS_COUNT,
    };
  }

  /**
   * 제약 조건을 적용한 사용 가능 pool을 반환한다.
   * pinned, excluded 번호를 모두 제거한다.
   * @param   {{ pinned: number[], excluded: number[] }} o
   * @returns {number[]}
   */
  function _buildPool(o) {
    return ALL_NUMBERS.filter(function (n) {
      return o.pinned.indexOf(n) === -1 && o.excluded.indexOf(n) === -1;
    });
  }

  /**
   * 세트를 완성한다: pinned + picked를 합쳐 오름차순 정렬.
   * @param   {number[]} picked
   * @param   {number[]} pinned
   * @returns {number[]}
   */
  function _finalizeSet(picked, pinned) {
    return pinned.concat(picked).sort(function (a, b) { return a - b; });
  }


  // ─────────────────────────────────────────────────────────────
  // 3. 내부 헬퍼: 난수 / 샘플링
  // ─────────────────────────────────────────────────────────────

  function _sampleRandom(pool, count) {
    var arr    = pool.slice();
    var result = [];
    var n      = Math.min(count, arr.length);
    for (var i = 0; i < n; i++) {
      var j    = i + Math.floor(Math.random() * (arr.length - i));
      var temp = arr[i];
      arr[i]   = arr[j];
      arr[j]   = temp;
      result.push(arr[i]);
    }
    return result.sort(function (a, b) { return a - b; });
  }

  function _weightedSample(weightMap, count) {
    var pool = [];
    weightMap.forEach(function (w, n) {
      pool.push({ n: n, w: Math.max(w, 0.001) });
    });
    var picked = [];
    for (var i = 0; i < count && pool.length > 0; i++) {
      var total  = pool.reduce(function (sum, item) { return sum + item.w; }, 0);
      var rand   = Math.random() * total;
      var cum    = 0;
      var chosen = pool.length - 1;
      for (var j = 0; j < pool.length; j++) {
        cum += pool[j].w;
        if (rand <= cum) { chosen = j; break; }
      }
      picked.push(pool[chosen].n);
      pool.splice(chosen, 1);
    }
    return picked.sort(function (a, b) { return a - b; });
  }


  // ─────────────────────────────────────────────────────────────
  // 4. 내부 헬퍼: 번호 특성 계산
  // ─────────────────────────────────────────────────────────────

  function _sum(arr)          { return arr.reduce(function (a, b) { return a + b; }, 0); }
  function _oddCount(nums)    { return nums.filter(function (n) { return n % 2 !== 0; }).length; }
  function _lowCount(nums)    { return nums.filter(function (n) { return n <= LOW_HIGH_BOUNDARY; }).length; }
  function _uniqueLastDigits(nums) { return new Set(nums.map(function (n) { return n % 10; })).size; }
  function _coveredRanges(nums) {
    return RANGES.filter(function (r) {
      return nums.some(function (n) { return n >= r.min && n <= r.max; });
    }).length;
  }
  function _consecutivePairs(nums) {
    var sorted = nums.slice().sort(function (a, b) { return a - b; });
    var pairs  = 0;
    for (var i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] === sorted[i] + 1) pairs++;
    }
    return pairs;
  }

  function _balanceScore(nums) {
    var score = 0, sum = _sum(nums), odd = _oddCount(nums), low = _lowCount(nums);
    if (sum >= 100 && sum <= 180) score += 30;
    else if (sum >= 80  && sum <= 200) score += 15;
    else if (sum >= 60  && sum <= 220) score += 5;
    if (odd === 3) score += 25;
    else if (odd === 2 || odd === 4) score += 15;
    else if (odd === 1 || odd === 5) score += 5;
    if (low === 3) score += 20;
    else if (low === 2 || low === 4) score += 12;
    else if (low === 1 || low === 5) score += 4;
    score += _coveredRanges(nums) * 6;
    score += _uniqueLastDigits(nums) * 4;

    // AC (Arithmetic Complexity, 산술 복잡도) 검증 필터 (7~10 황금 구간)
    if (window.LottoAnalysis && window.LottoAnalysis.calcAC) {
      var acVal = window.LottoAnalysis.calcAC(nums).ac;
      if (acVal >= 7 && acVal <= 10) score += 20;
      else if (acVal >= 5 && acVal <= 6) score += 8;
      else score -= 15;
    }

    var consec = _consecutivePairs(nums);
    if (consec === 1) score += 5;
    else if (consec === 2) score += 2;
    else if (consec >= 3) score -= 20;
    return score;
  }


  function _calcFreqFallback(data, limit) {
    var slice = (limit > 0) ? data.slice(0, limit) : data;
    var freq  = new Map(ALL_NUMBERS.map(function (n) { return [n, 0]; }));
    slice.forEach(function (round) {
      round.numbers.forEach(function (n) { freq.set(n, (freq.get(n) || 0) + 1); });
    });
    return freq;
  }

  function _calcAbsentFallback(data) {
    return ALL_NUMBERS.map(function (num) {
      var absentFor = data.length;
      for (var i = 0; i < data.length; i++) {
        if (data[i].numbers.indexOf(num) !== -1) { absentFor = i; break; }
      }
      return { number: num, absentFor: absentFor };
    }).sort(function (a, b) { return b.absentFor - a.absentFor; });
  }


  // ─────────────────────────────────────────────────────────────
  // 5. 내부 헬퍼: reason 문자열
  // ─────────────────────────────────────────────────────────────

  function _basicStats(nums) {
    var odd = _oddCount(nums), low = _lowCount(nums);
    return '홀수 ' + odd + '개/짝수 ' + (6-odd) + '개 · 저 ' + low + '/고 ' + (6-low) + ' · 합계 ' + _sum(nums);
  }

  function _pinnedNote(pinned) {
    return pinned.length > 0 ? ' [고정: ' + pinned.sort(function(a,b){return a-b;}).join(', ') + '번]' : '';
  }

  function _reasonRandom(nums, pinned) {
    return '1~45 전체 번호에서 동일 확률로 무작위 선택한 번호입니다.' + _pinnedNote(pinned) + ' ' + _basicStats(nums) + '.';
  }

  function _reasonFrequency(nums, freq, totalRounds, pinned) {
    var counts   = nums.map(function (n) { return freq.get(n) || 0; });
    var avgCount = Math.round(counts.reduce(function (a, b) { return a + b; }, 0) / counts.length);
    var maxIdx   = counts.indexOf(Math.max.apply(null, counts));
    return '전체 ' + totalRounds + '회차 출현 빈도 가중 확률로 선택했습니다. 평균 ' + avgCount + '회 출현.' + _pinnedNote(pinned) + ' ' + _basicStats(nums) + '.';
  }

  function _reasonAbsent(nums, absentMap, pinned) {
    var absents    = nums.map(function (n) { return { n: n, for: absentMap.get(n) || 0 }; });
    var topAbsent  = absents.reduce(function (a, b) { return a.for >= b.for ? a : b; });
    var avgAbsent  = Math.round(absents.reduce(function (s, a) { return s + a.for; }, 0) / absents.length);
    return '최근 미출현 번호 우선 선택. ' + topAbsent.n + '번 ' + topAbsent.for + '회 연속 미출현. 평균 미출현 ' + avgAbsent + '회.' + _pinnedNote(pinned) + ' ' + _basicStats(nums) + '.';
  }

  function _reasonBalanced(nums, pinned) {
    var covered = RANGES.filter(function (r) {
      return nums.some(function (n) { return n >= r.min && n <= r.max; });
    }).map(function (r) { return r.label; });
    return '홀짝·저고·합계·구간 균형 최적화. ' + covered.join(' · ') + ' 분포.' + _pinnedNote(pinned) + ' ' + _basicStats(nums) + '.';
  }

  function _reasonAIMix(nums, perNumScores, pinned) {
    var topNum = nums.reduce(function (best, n) {
      return (perNumScores.get(n).composite > perNumScores.get(best).composite) ? n : best;
    }, nums[0]);
    var mostAbsent = nums.reduce(function (best, n) {
      return (perNumScores.get(n).absentFor > perNumScores.get(best).absentFor) ? n : best;
    }, nums[0]);
    var absentFor = perNumScores.get(mostAbsent).absentFor;
    return '출현빈도(30%)·최근출현(25%)·미출현보정(20%)·기본확률(25%) 복합 AI 추천. '
      + topNum + '번 종합점수 최상위.'
      + (absentFor > 3 ? ' ' + mostAbsent + '번 ' + absentFor + '회 미출현.' : '')
      + _pinnedNote(pinned) + ' ' + _basicStats(nums) + '.';
  }


  // ─────────────────────────────────────────────────────────────
  // 6. 알고리즘 1: 완전 랜덤
  // ─────────────────────────────────────────────────────────────

  function generateRandom(options) {
    var o    = _resolveOptions(options);
    var pool = _buildPool(o);
    var sets = [];
    for (var i = 0; i < o.count; i++) {
      var picked = _sampleRandom(pool, 6 - o.pinned.length);
      var nums   = _finalizeSet(picked, o.pinned);
      sets.push({ numbers: nums, reason: _reasonRandom(nums, o.pinned) });
    }
    return { type: 'random', label: '완전 랜덤', disclaimer: DISCLAIMER, sets: sets };
  }


  // ─────────────────────────────────────────────────────────────
  // 7. 알고리즘 2: 출현빈도 기반
  // ─────────────────────────────────────────────────────────────

  function generateFrequency(data, options) {
    if (!data || data.length === 0) return generateRandom(options);
    var o    = _resolveOptions(options);
    var pool = _buildPool(o);
    var freq = window.LottoAnalysis
      ? window.LottoAnalysis.calcFrequency(data, 0)
      : _calcFreqFallback(data, 0);

    // pool 번호만 가중치 Map에 포함
    var weights = new Map();
    pool.forEach(function (n) { weights.set(n, (freq.get(n) || 0) + 1); });

    var sets = [];
    for (var i = 0; i < o.count; i++) {
      var picked = _weightedSample(weights, 6 - o.pinned.length);
      var nums   = _finalizeSet(picked, o.pinned);
      sets.push({ numbers: nums, reason: _reasonFrequency(nums, freq, data.length, o.pinned) });
    }
    return { type: 'frequency', label: '출현빈도 기반', disclaimer: DISCLAIMER, sets: sets };
  }


  // ─────────────────────────────────────────────────────────────
  // 8. 알고리즘 3: 최근 미출현 번호
  // ─────────────────────────────────────────────────────────────

  function generateAbsent(data, options) {
    if (!data || data.length === 0) return generateRandom(options);
    var o          = _resolveOptions(options);
    var pool       = _buildPool(o);
    var absentList = window.LottoAnalysis
      ? window.LottoAnalysis.calcLongestAbsent(data)
      : _calcAbsentFallback(data);

    var absentMap = new Map(absentList.map(function (a) { return [a.number, a.absentFor]; }));

    // pool 내 번호만 가중치
    var weights = new Map();
    pool.forEach(function (n) {
      weights.set(n, Math.pow((absentMap.get(n) || 0) + 1, 1.8));
    });

    var sets = [];
    for (var i = 0; i < o.count; i++) {
      var picked = _weightedSample(weights, 6 - o.pinned.length);
      var nums   = _finalizeSet(picked, o.pinned);
      sets.push({ numbers: nums, reason: _reasonAbsent(nums, absentMap, o.pinned) });
    }
    return { type: 'absent', label: '최근 미출현 번호', disclaimer: DISCLAIMER, sets: sets };
  }


  // ─────────────────────────────────────────────────────────────
  // 9. 알고리즘 4: 균형형
  // ─────────────────────────────────────────────────────────────

  function generateBalanced(data, options) {
    var o    = _resolveOptions(options);
    var pool = _buildPool(o);
    var sets = [];
    for (var s = 0; s < o.count; s++) {
      var best = null, bestScore = -Infinity;
      for (var attempt = 0; attempt < 300; attempt++) {
        var candidate = _buildBalancedCandidate(pool, o.pinned);
        var score     = _balanceScore(candidate);
        if (score > bestScore) { bestScore = score; best = candidate; }
      }
      sets.push({ numbers: best, reason: _reasonBalanced(best, o.pinned) });
    }
    return { type: 'balanced', label: '균형형', disclaimer: DISCLAIMER, sets: sets };
  }

  function _buildBalancedCandidate(pool, pinned) {
    var picked = [];
    var need   = 6 - pinned.length;

    // 5구간에서 각 1개씩 (pool 내 번호만)
    var covered = 0;
    for (var r = 0; r < RANGES.length && covered < need; r++) {
      var zone = pool.filter(function (n) {
        return n >= RANGES[r].min && n <= RANGES[r].max && picked.indexOf(n) === -1;
      });
      if (zone.length > 0) {
        picked.push(zone[Math.floor(Math.random() * zone.length)]);
        covered++;
      }
    }

    // 부족한 경우 남은 pool에서 채움
    while (picked.length < need) {
      var remaining = pool.filter(function (n) { return picked.indexOf(n) === -1; });
      if (remaining.length === 0) break;
      picked.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }

    return _finalizeSet(picked, pinned);
  }


  // ─────────────────────────────────────────────────────────────
  // 10. 알고리즘 5: AI Mix
  // ─────────────────────────────────────────────────────────────

  function generateAIMix(data, options) {
    if (!data || data.length === 0) return generateBalanced(data, options);
    var o    = _resolveOptions(options);
    var pool = _buildPool(o);

    var A = window.LottoAnalysis;
    var coMatrix = (A && A.calcCoOccurrenceMatrix) ? A.calcCoOccurrenceMatrix(data, 0) : null;
    var perNumScores = _computePerNumberScores(data, pool);

    // pool 내 번호만 가중치
    var weights = new Map();
    pool.forEach(function (n) {
      var s = perNumScores.get(n);
      weights.set(n, (s ? s.composite : 0.25) + 0.05);
    });

    var sets = [];
    for (var s = 0; s < o.count; s++) {
      var best = null, bestTotal = -Infinity;
      for (var attempt = 0; attempt < 120; attempt++) {
        var picked = _weightedSample(weights, 6 - o.pinned.length);
        var nums   = _finalizeSet(picked, o.pinned);
        var total  = _balanceScore(nums) + _aiBonus(nums, perNumScores, coMatrix);
        if (total > bestTotal) { bestTotal = total; best = nums; }
      }
      sets.push({ numbers: best, reason: _reasonAIMix(best, perNumScores, o.pinned) });
    }
    return { type: 'ai-mix', label: 'AI Mix', disclaimer: DISCLAIMER, sets: sets };
  }

  /**
   * 각 번호의 복합 점수를 계산한다 (이월수 및 최근 트렌드 가중치 포함)
   */
  function _computePerNumberScores(data, pool) {
    var A = window.LottoAnalysis;
    var freqAll    = A ? A.calcFrequency(data, 0)  : _calcFreqFallback(data, 0);
    var maxFreqAll = Math.max.apply(null, Array.from(freqAll.values())) || 1;
    var freqRecent    = A ? A.calcFrequency(data, 15) : _calcFreqFallback(data, 15);
    var maxFreqRecent = Math.max.apply(null, Array.from(freqRecent.values())) || 1;
    var absentList = A ? A.calcLongestAbsent(data) : _calcAbsentFallback(data);
    var absentMap  = new Map(absentList.map(function (a) { return [a.number, a.absentFor]; }));
    var maxAbsent  = Math.max.apply(null, Array.from(absentMap.values())) || 1;

    // 직전 회차 당첨 번호 (이월수 가중치)
    var lastRoundNums = (data && data.length > 0) ? data[0].numbers : [];

    var result = new Map();
    (pool || ALL_NUMBERS).forEach(function (n) {
      var freqScore    = (freqAll.get(n)    || 0) / maxFreqAll;
      var recentScore  = (freqRecent.get(n) || 0) / maxFreqRecent;
      var absentScore  = (absentMap.get(n)  || 0) / maxAbsent;
      var isCarryover  = lastRoundNums.indexOf(n) !== -1;
      var carryBonus   = isCarryover ? 0.25 : 0;

      var composite   = freqScore * 0.25 + recentScore * 0.25 + absentScore * 0.15 + carryBonus + 0.10;
      result.set(n, {
        composite: composite,
        freqCount: freqAll.get(n) || 0,
        absentFor: absentMap.get(n) || 0,
        isCarryover: isCarryover
      });
    });
    return result;
  }

  function _aiBonus(nums, perNumScores, coMatrix) {
    var bonus = 0;
    nums.forEach(function (n) {
      var s = perNumScores.get(n);
      if (s) bonus += s.composite * 15;
    });
    bonus += _uniqueLastDigits(nums) * 5;

    // 1. 궁합수(동시 출현 빈도 행렬) 점수 산출
    if (coMatrix) {
      var pairScore = 0;
      for (var i = 0; i < nums.length - 1; i++) {
        for (var j = i + 1; j < nums.length; j++) {
          var pairKey = nums[i] + '-' + nums[j];
          pairScore += (coMatrix.get(pairKey) || 0);
        }
      }
      bonus += Math.min(pairScore * 0.2, 25); // 최대 +25점
    }

    // 2. 이월수 황금 비율 보너스 (직전 회차 번호 1~2개 포함 시 +12점)
    var carryCount = nums.filter(function (n) {
      var s = perNumScores.get(n);
      return s && s.isCarryover;
    }).length;

    if (carryCount === 1 || carryCount === 2) bonus += 12;
    else if (carryCount >= 4) bonus -= 15;

    var consec = _consecutivePairs(nums);
    if (consec === 1 || consec === 2) bonus += 8;
    else if (consec >= 4) bonus -= 20;

    return bonus;
  }



  // ─────────────────────────────────────────────────────────────
  // 11. 전체 알고리즘 일괄 실행
  // ─────────────────────────────────────────────────────────────

  function generateAll(data, options) {
    return {
      random:     generateRandom(options),
      frequency:  generateFrequency(data, options),
      absent:     generateAbsent(data, options),
      balanced:   generateBalanced(data, options),
      aiMix:      generateAIMix(data, options),
      disclaimer: DISCLAIMER,
    };
  }


  // ─────────────────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────────────────
  return {
    generateAll:       generateAll,
    generateRandom:    generateRandom,
    generateFrequency: generateFrequency,
    generateAbsent:    generateAbsent,
    generateBalanced:  generateBalanced,
    generateAIMix:     generateAIMix,
    DISCLAIMER:        DISCLAIMER,
  };

})();
