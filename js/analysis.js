/**
 * analysis.js  —  로또 번호 통계 분석 모듈
 *
 * 전역 네임스페이스: window.LottoAnalysis
 * ES6 module 미사용 → file:// 프로토콜에서도 정상 동작
 *
 * 공개 API (모두 순수 함수):
 *
 * [출현 빈도]
 *   calcFrequency(data, limit?)        번호별 출현 횟수 → Map<number,number>
 *   calcFrequencyByRange(data)         최근 10/30/50회/전체 비교 → Object
 *
 * [미출현]
 *   calcMissingNumbers(data, limit?)   미출현 번호 목록 → number[]
 *   calcLongestAbsent(data)            최장 미출현 번호 순위 → Array
 *
 * [홀짝 / 저고]
 *   calcOddEvenRatio(numbers)          홀짝 비율 (단일 회차)
 *   calcOddEvenStats(data, limit?)     홀짝 통계 (다중 회차)
 *   calcLowHighRatio(numbers)          저번호/고번호 비율 (단일 회차)
 *   calcLowHighStats(data, limit?)     저번호/고번호 통계 (다중 회차)
 *
 * [합계 / 평균 / 중앙값]
 *   calcSum(numbers)                   번호 합계 (단일 회차)
 *   calcSumStats(data, limit?)         합계 통계 {min,max,avg,stddev}
 *   calcMean(numbers)                  평균값 (단일 회차)
 *   calcMedian(numbers)                중앙값 (단일 회차)
 *
 * [끝수 / 구간 분포]
 *   calcLastDigit(numbers)             끝수 분포 (단일 회차) → Map
 *   calcLastDigitStats(data, limit?)   끝수 누적 분포 (다중 회차) → Map
 *   calcRangeDistribution(numbers)     구간별 분포 (단일 회차)
 *   calcRangeStats(data, limit?)       구간별 누적 분포 (다중 회차)
 *
 * [패턴]
 *   calcConsecutive(numbers)           연속번호 분석 (단일 회차)
 *   calcConsecutiveStats(data, limit?) 연속번호 통계 (다중 회차)
 *   calcSameLastDigit(numbers)         동일 끝수 (단일 회차)
 *   calcSameLastDigitStats(data, limit?) 동일 끝수 통계 (다중 회차)
 *
 * [복잡도]
 *   calcAC(numbers)                    AC값 (단일 회차)
 *   calcACStats(data, limit?)          AC값 통계 (다중 회차)
 *
 * [종합]
 *   analyzeRound(numbers)              단일 회차 전체 분석
 *   analyzeAll(data, limit?)           다중 회차 전체 분석
 *
 * @namespace LottoAnalysis
 */
window.LottoAnalysis = (function () {

  // ─────────────────────────────────────────────────────────────
  // 공통 상수
  // ─────────────────────────────────────────────────────────────

  /** 전체 번호 배열 [1 … 45] */
  const ALL_NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1);

  /** 구간 정의 (5구간) */
  const RANGES = [
    { label: '1~9',   min: 1,  max: 9  },
    { label: '10~19', min: 10, max: 19 },
    { label: '20~29', min: 20, max: 29 },
    { label: '30~39', min: 30, max: 39 },
    { label: '40~45', min: 40, max: 45 },
  ];

  /** 저번호 / 고번호 기준선 (1~22 저, 23~45 고) */
  const LOW_HIGH_BOUNDARY = 22;


  // ─────────────────────────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────────────────────────

  /**
   * 데이터를 최근 N회로 자른다.
   * limit이 없거나 0이면 전체를 반환한다.
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {Object[]}
   */
  function _slice(data, limit) {
    limit = limit || 0;
    if (!data || data.length === 0) return [];
    return limit > 0 ? data.slice(0, limit) : data;
  }

  /** 배열 합산 */
  function _sum(arr) {
    return arr.reduce(function (acc, v) { return acc + v; }, 0);
  }

  /** 배열 평균 */
  function _mean(arr) {
    if (arr.length === 0) return 0;
    return _sum(arr) / arr.length;
  }

  /** 배열 표준편차 (모 표준편차) */
  function _stddev(arr) {
    if (arr.length === 0) return 0;
    var m = _mean(arr);
    return Math.sqrt(_mean(arr.map(function (v) { return (v - m) * (v - m); })));
  }


  // ═══════════════════════════════════════════════════════════
  // 1. 번호별 출현 횟수 (빈도)
  // ═══════════════════════════════════════════════════════════

  /**
   * 번호별 출현 횟수를 계산한다.
   *
   * 보너스 번호는 기본적으로 포함하지 않는다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]     최근 N회 (0 = 전체)
   * @param   {boolean}  [includeBonus=false]
   * @returns {Map<number, number>}    번호 → 출현 횟수 (1~45 전부 포함)
   *
   * @example
   * var freq = LottoAnalysis.calcFrequency(data, 30);
   * freq.get(7); // → 5
   */
  function calcFrequency(data, limit, includeBonus) {
    limit        = limit || 0;
    includeBonus = includeBonus || false;
    var slice = _slice(data, limit);

    // 1~45 모두 0으로 초기화 (미출현도 포함)
    var freq = new Map(ALL_NUMBERS.map(function (n) { return [n, 0]; }));

    slice.forEach(function (round) {
      round.numbers.forEach(function (n) {
        freq.set(n, (freq.get(n) || 0) + 1);
      });
      if (includeBonus && round.bonus) {
        freq.set(round.bonus, (freq.get(round.bonus) || 0) + 1);
      }
    });

    return freq;
  }


  /**
   * 최근 10 / 30 / 50회 및 전체 빈도를 한 번에 계산한다.
   *
   * @param   {Object[]} data
   * @returns {{ recent10: Map, recent30: Map, recent50: Map, all: Map }}
   *
   * @example
   * var ranges = LottoAnalysis.calcFrequencyByRange(data);
   * ranges.recent10.get(13); // → 3
   */
  function calcFrequencyByRange(data) {
    return {
      recent10: calcFrequency(data, 10),
      recent30: calcFrequency(data, 30),
      recent50: calcFrequency(data, 50),
      all:      calcFrequency(data, 0),
    };
  }


  // ═══════════════════════════════════════════════════════════
  // 2. 미출현 번호
  // ═══════════════════════════════════════════════════════════

  /**
   * 최근 N회 동안 출현하지 않은 번호 목록을 반환한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {number[]}  오름차순
   *
   * @example
   * LottoAnalysis.calcMissingNumbers(data, 10); // → [4, 6, 23, …]
   */
  function calcMissingNumbers(data, limit) {
    var freq = calcFrequency(data, limit);
    return ALL_NUMBERS.filter(function (n) { return freq.get(n) === 0; });
  }


  /**
   * 각 번호의 연속 미출현 회차 수를 계산한다 (최장 순 정렬).
   *
   * data[0]이 최신 회차이므로 인덱스 i = "i회 전"을 의미한다.
   *
   * @param   {Object[]} data   최신 회차가 앞에 있어야 함
   * @returns {Array<{number:number, absentFor:number, lastRound:number|null}>}
   *          absentFor: 연속 미출현 회차 수
   *          lastRound: 마지막 출현 회차 번호 (없으면 null)
   *
   * @example
   * LottoAnalysis.calcLongestAbsent(data)[0];
   * // → { number: 34, absentFor: 18, lastRound: 1162 }
   */
  function calcLongestAbsent(data) {
    if (!data || data.length === 0) return [];

    var result = ALL_NUMBERS.map(function (num) {
      var absentFor = data.length; // 기본: 전체 미출현
      var lastRound = null;

      for (var i = 0; i < data.length; i++) {
        if (data[i].numbers.indexOf(num) !== -1) {
          absentFor = i;
          lastRound = data[i].round;
          break;
        }
      }

      return { number: num, absentFor: absentFor, lastRound: lastRound };
    });

    // 미출현 회차 수 내림차순
    return result.sort(function (a, b) { return b.absentFor - a.absentFor; });
  }


  // ═══════════════════════════════════════════════════════════
  // 3. 홀짝 비율
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차의 홀짝 비율을 계산한다.
   *
   * @param   {number[]} numbers
   * @returns {{ odd: number, even: number, ratio: string }}
   *
   * @example
   * LottoAnalysis.calcOddEvenRatio([1,7,13,25,36,44]);
   * // → { odd: 4, even: 2, ratio: "4:2" }
   */
  function calcOddEvenRatio(numbers) {
    var odd  = numbers.filter(function (n) { return n % 2 !== 0; }).length;
    var even = numbers.length - odd;
    return { odd: odd, even: even, ratio: odd + ':' + even };
  }


  /**
   * 다중 회차에 걸친 홀짝 비율 통계를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {{ distribution: Map<string,number>, avgOdd: number, avgEven: number, totalRounds: number }}
   *
   * @example
   * LottoAnalysis.calcOddEvenStats(data, 30).distribution.get("3:3"); // → 8
   */
  function calcOddEvenStats(data, limit) {
    var slice = _slice(data, limit);
    var distribution = new Map();
    var oddCounts    = [];

    slice.forEach(function (round) {
      var r = calcOddEvenRatio(round.numbers);
      distribution.set(r.ratio, (distribution.get(r.ratio) || 0) + 1);
      oddCounts.push(r.odd);
    });

    var avgOdd = _mean(oddCounts);
    return {
      distribution: distribution,
      avgOdd:       Math.round(avgOdd * 100) / 100,
      avgEven:      Math.round((6 - avgOdd) * 100) / 100,
      totalRounds:  slice.length,
    };
  }


  // ═══════════════════════════════════════════════════════════
  // 4. 저번호 / 고번호 비율 (1~22 저, 23~45 고)
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차의 저번호(1~22) / 고번호(23~45) 비율을 계산한다.
   *
   * @param   {number[]} numbers
   * @returns {{ low: number, high: number, ratio: string }}
   *
   * @example
   * LottoAnalysis.calcLowHighRatio([1,7,13,25,36,44]);
   * // → { low: 3, high: 3, ratio: "3:3" }
   */
  function calcLowHighRatio(numbers) {
    var low  = numbers.filter(function (n) { return n <= LOW_HIGH_BOUNDARY; }).length;
    var high = numbers.length - low;
    return { low: low, high: high, ratio: low + ':' + high };
  }


  /**
   * 다중 회차에 걸친 저/고 비율 통계를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {{ distribution: Map<string,number>, avgLow: number, avgHigh: number, totalRounds: number }}
   */
  function calcLowHighStats(data, limit) {
    var slice = _slice(data, limit);
    var distribution = new Map();
    var lowCounts    = [];

    slice.forEach(function (round) {
      var r = calcLowHighRatio(round.numbers);
      distribution.set(r.ratio, (distribution.get(r.ratio) || 0) + 1);
      lowCounts.push(r.low);
    });

    var avgLow = _mean(lowCounts);
    return {
      distribution: distribution,
      avgLow:       Math.round(avgLow * 100) / 100,
      avgHigh:      Math.round((6 - avgLow) * 100) / 100,
      totalRounds:  slice.length,
    };
  }


  // ═══════════════════════════════════════════════════════════
  // 5. 번호 합계
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차의 당첨번호 합계를 반환한다.
   * 이론적 범위: 21(최솟값) ~ 255(최댓값), 평균 약 138
   *
   * @param   {number[]} numbers
   * @returns {number}
   *
   * @example
   * LottoAnalysis.calcSum([1,7,13,25,36,44]); // → 126
   */
  function calcSum(numbers) {
    return _sum(numbers);
  }


  /**
   * 다중 회차에 걸친 합계 통계를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {{ min: number, max: number, avg: number, stddev: number, values: number[], totalRounds: number }}
   *
   * @example
   * LottoAnalysis.calcSumStats(data, 30).avg; // → 138.5
   */
  function calcSumStats(data, limit) {
    var slice  = _slice(data, limit);
    var values = slice.map(function (r) { return calcSum(r.numbers); });

    return {
      min:         values.length > 0 ? Math.min.apply(null, values) : 0,
      max:         values.length > 0 ? Math.max.apply(null, values) : 0,
      avg:         Math.round(_mean(values) * 100) / 100,
      stddev:      Math.round(_stddev(values) * 100) / 100,
      values:      values,
      totalRounds: slice.length,
    };
  }


  // ═══════════════════════════════════════════════════════════
  // 6. 평균값 / 중앙값
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차 번호들의 평균값을 반환한다.
   *
   * @param   {number[]} numbers
   * @returns {number}   소수점 2자리
   *
   * @example
   * LottoAnalysis.calcMean([1,7,13,25,36,44]); // → 21.0
   */
  function calcMean(numbers) {
    return Math.round(_mean(numbers) * 100) / 100;
  }


  /**
   * 단일 회차 번호들의 중앙값을 반환한다.
   *
   * 6개 번호이므로 3번째와 4번째 값의 평균이 중앙값이다.
   * 입력 배열은 오름차순 정렬되어 있다고 가정한다.
   *
   * @param   {number[]} numbers  오름차순 정렬된 6개 번호
   * @returns {number}
   *
   * @example
   * LottoAnalysis.calcMedian([1,7,13,25,36,44]); // → 19  ( (13+25)/2 )
   */
  function calcMedian(numbers) {
    var sorted = numbers.slice().sort(function (a, b) { return a - b; });
    var mid    = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }


  // ═══════════════════════════════════════════════════════════
  // 7. 끝수(단위 자리) 분포
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차 번호들의 끝수(단위 자리, 0~9) 분포를 계산한다.
   *
   * 끝수 0: 10, 20, 30, 40
   * 끝수 1: 1, 11, 21, 31, 41
   * ...
   *
   * @param   {number[]} numbers
   * @returns {Map<number, number[]>}  끝수(0~9) → 해당 번호 목록
   *
   * @example
   * LottoAnalysis.calcLastDigit([1,7,13,25,36,44]);
   * // → Map { 1→[1], 7→[7], 3→[13], 5→[25], 6→[36], 4→[44] }
   */
  function calcLastDigit(numbers) {
    var map = new Map();
    numbers.forEach(function (n) {
      var digit = n % 10;
      if (!map.has(digit)) map.set(digit, []);
      map.get(digit).push(n);
    });
    return map;
  }


  /**
   * 다중 회차에 걸친 끝수 누적 분포를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {Map<number, number>}  끝수(0~9) → 총 출현 횟수
   *
   * @example
   * LottoAnalysis.calcLastDigitStats(data, 30).get(5); // → 12
   */
  function calcLastDigitStats(data, limit) {
    var slice = _slice(data, limit);
    // 0~9 모두 0으로 초기화
    var dist = new Map(Array.from({ length: 10 }, function (_, i) { return [i, 0]; }));

    slice.forEach(function (round) {
      round.numbers.forEach(function (n) {
        var digit = n % 10;
        dist.set(digit, (dist.get(digit) || 0) + 1);
      });
    });

    return dist;
  }


  // ═══════════════════════════════════════════════════════════
  // 8. 구간별 분포 (1~9 / 10~19 / 20~29 / 30~39 / 40~45)
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차 번호들의 구간별 분포를 계산한다.
   *
   * @param   {number[]} numbers
   * @returns {Array<{label:string, min:number, max:number, count:number, numbers:number[]}>}
   *
   * @example
   * LottoAnalysis.calcRangeDistribution([1,7,13,25,36,44]);
   * // → [{label:'1~9',count:2,...}, {label:'10~19',count:1,...}, ...]
   */
  function calcRangeDistribution(numbers) {
    return RANGES.map(function (range) {
      var nums = numbers.filter(function (n) { return n >= range.min && n <= range.max; });
      return { label: range.label, min: range.min, max: range.max, count: nums.length, numbers: nums };
    });
  }


  /**
   * 다중 회차에 걸친 구간별 누적 출현 횟수를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {Array<{label:string, min:number, max:number, total:number, avgPerRound:number}>}
   *
   * @example
   * LottoAnalysis.calcRangeStats(data, 30)[0].avgPerRound; // 1~9 구간 평균
   */
  function calcRangeStats(data, limit) {
    var slice = _slice(data, limit);
    if (slice.length === 0) {
      return RANGES.map(function (r) {
        return { label: r.label, min: r.min, max: r.max, total: 0, avgPerRound: 0 };
      });
    }

    var totals = new Array(RANGES.length).fill(0);

    slice.forEach(function (round) {
      calcRangeDistribution(round.numbers).forEach(function (d, i) {
        totals[i] += d.count;
      });
    });

    return RANGES.map(function (range, i) {
      return {
        label:       range.label,
        min:         range.min,
        max:         range.max,
        total:       totals[i],
        avgPerRound: Math.round((totals[i] / slice.length) * 100) / 100,
      };
    });
  }


  // ═══════════════════════════════════════════════════════════
  // 9. 연속번호
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차 번호에서 연속번호 쌍과 그룹을 분석한다.
   *
   * 연속번호: 차이가 1인 두 번호 (예: 13과 14)
   *
   * @param   {number[]} numbers  오름차순 정렬된 6개 번호
   * @returns {{
   *   pairCount:      number,    연속 쌍의 수
   *   groups:         number[][], 연속 그룹 배열
   *   maxLength:      number,    가장 긴 그룹 길이
   *   hasConsecutive: boolean    연속번호 존재 여부
   * }}
   *
   * @example
   * LottoAnalysis.calcConsecutive([1,7,13,14,36,37]);
   * // → { pairCount:2, groups:[[13,14],[36,37]], maxLength:2, hasConsecutive:true }
   */
  function calcConsecutive(numbers) {
    var sorted  = numbers.slice().sort(function (a, b) { return a - b; });
    var groups  = [];
    var current = [sorted[0]];

    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        current.push(sorted[i]);
      } else {
        if (current.length >= 2) groups.push(current.slice());
        current = [sorted[i]];
      }
    }
    if (current.length >= 2) groups.push(current.slice());

    var pairCount = groups.reduce(function (sum, g) { return sum + (g.length - 1); }, 0);
    var maxLength = groups.length > 0 ? Math.max.apply(null, groups.map(function (g) { return g.length; })) : 0;

    return {
      pairCount:      pairCount,
      groups:         groups,
      maxLength:      maxLength,
      hasConsecutive: groups.length > 0,
    };
  }


  /**
   * 다중 회차에 걸친 연속번호 통계를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {{
   *   withConsecutive:    number,
   *   withoutConsecutive: number,
   *   consecutiveRate:    number,
   *   avgPairCount:       number,
   *   distribution:       Map<number,number>,
   *   totalRounds:        number
   * }}
   */
  function calcConsecutiveStats(data, limit) {
    var slice        = _slice(data, limit);
    var distribution = new Map();
    var withC        = 0;
    var pairCounts   = [];

    slice.forEach(function (round) {
      var r = calcConsecutive(round.numbers);
      pairCounts.push(r.pairCount);
      distribution.set(r.pairCount, (distribution.get(r.pairCount) || 0) + 1);
      if (r.hasConsecutive) withC++;
    });

    return {
      withConsecutive:    withC,
      withoutConsecutive: slice.length - withC,
      consecutiveRate:    slice.length > 0 ? Math.round((withC / slice.length) * 1000) / 1000 : 0,
      avgPairCount:       Math.round(_mean(pairCounts) * 100) / 100,
      distribution:       distribution,
      totalRounds:        slice.length,
    };
  }


  // ═══════════════════════════════════════════════════════════
  // 10. 동일 끝수
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차에서 동일한 끝수(단위 자리)를 공유하는 그룹을 반환한다.
   *
   * @param   {number[]} numbers
   * @returns {{
   *   groups:       Array<{digit:number, numbers:number[]}>,
   *   maxGroupSize: number,
   *   hasDuplicate: boolean
   * }}
   *
   * @example
   * LottoAnalysis.calcSameLastDigit([1,11,13,23,36,44]);
   * // → { groups:[{digit:1,numbers:[1,11]},{digit:3,numbers:[13,23]}],
   * //     maxGroupSize:2, hasDuplicate:true }
   */
  function calcSameLastDigit(numbers) {
    var digitMap = calcLastDigit(numbers);
    var groups   = [];

    digitMap.forEach(function (nums, digit) {
      if (nums.length >= 2) {
        groups.push({ digit: digit, numbers: nums });
      }
    });

    // 그룹 크기 내림차순
    groups.sort(function (a, b) { return b.numbers.length - a.numbers.length; });

    var maxGroupSize = groups.length > 0 ? groups[0].numbers.length : 0;

    return {
      groups:       groups,
      maxGroupSize: maxGroupSize,
      hasDuplicate: groups.length > 0,
    };
  }


  /**
   * 다중 회차에 걸친 동일 끝수 통계를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {{ withDuplicate:number, withoutDuplicate:number, duplicateRate:number, totalRounds:number }}
   */
  function calcSameLastDigitStats(data, limit) {
    var slice = _slice(data, limit);
    var withD = 0;

    slice.forEach(function (round) {
      if (calcSameLastDigit(round.numbers).hasDuplicate) withD++;
    });

    return {
      withDuplicate:    withD,
      withoutDuplicate: slice.length - withD,
      duplicateRate:    slice.length > 0 ? Math.round((withD / slice.length) * 1000) / 1000 : 0,
      totalRounds:      slice.length,
    };
  }


  // ═══════════════════════════════════════════════════════════
  // 11. AC값 (Arithmetic Complexity, 산술 복잡도)
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차의 AC값(산술 복잡도)을 계산한다.
   *
   * 계산 방법:
   *  1. 6개 번호의 모든 쌍(C(6,2)=15쌍)의 차이(절댓값)를 구한다.
   *  2. 중복 제거 후 고유 차이 개수를 센다.
   *  3. AC = 고유 차이 수 - (번호 개수 - 1) = 고유 차이 수 - 5
   *
   * AC 범위: 0 ~ 10 (높을수록 복잡한 조합. 일반적으로 AC ≥ 7 권장)
   *
   * @param   {number[]} numbers
   * @returns {{ ac: number, uniqueDiffs: number, diffs: number[] }}
   *
   * @example
   * LottoAnalysis.calcAC([1,7,13,25,36,44]);
   * // 15쌍 차이 중 고유 13개 → AC = 13 - 5 = 8
   * // → { ac: 8, uniqueDiffs: 13, diffs: [...] }
   */
  function calcAC(numbers) {
    var sorted = numbers.slice().sort(function (a, b) { return a - b; });
    var diffs  = [];

    // 모든 쌍의 차이 계산
    for (var i = 0; i < sorted.length - 1; i++) {
      for (var j = i + 1; j < sorted.length; j++) {
        diffs.push(sorted[j] - sorted[i]);
      }
    }

    var uniqueDiffs = new Set(diffs).size;
    var ac          = uniqueDiffs - (sorted.length - 1);

    return { ac: ac, uniqueDiffs: uniqueDiffs, diffs: diffs };
  }


  /**
   * 다중 회차에 걸친 AC값 통계를 계산한다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {{ min:number, max:number, avg:number, distribution:Map<number,number>, values:number[], totalRounds:number }}
   *
   * @example
   * LottoAnalysis.calcACStats(data, 50).avg; // → 7.2
   */
  function calcACStats(data, limit) {
    var slice        = _slice(data, limit);
    var values       = slice.map(function (r) { return calcAC(r.numbers).ac; });
    var distribution = new Map();

    values.forEach(function (ac) {
      distribution.set(ac, (distribution.get(ac) || 0) + 1);
    });

    return {
      min:         values.length > 0 ? Math.min.apply(null, values) : 0,
      max:         values.length > 0 ? Math.max.apply(null, values) : 0,
      avg:         Math.round(_mean(values) * 100) / 100,
      distribution: distribution,
      values:       values,
      totalRounds:  slice.length,
    };
  }


  // ═══════════════════════════════════════════════════════════
  // 12. 종합 분석
  // ═══════════════════════════════════════════════════════════

  /**
   * 단일 회차의 모든 통계를 한 번에 계산한다.
   *
   * @param   {number[]} numbers  오름차순 6개 번호
   * @returns {Object}
   *
   * @example
   * var a = LottoAnalysis.analyzeRound([1,7,13,25,36,44]);
   * a.sum;    // → 126
   * a.ac.ac;  // → 8
   */
  function analyzeRound(numbers) {
    return {
      sum:           calcSum(numbers),
      mean:          calcMean(numbers),
      median:        calcMedian(numbers),
      oddEven:       calcOddEvenRatio(numbers),
      lowHigh:       calcLowHighRatio(numbers),
      rangeDistrib:  calcRangeDistribution(numbers),
      lastDigit:     calcLastDigit(numbers),
      consecutive:   calcConsecutive(numbers),
      sameLastDigit: calcSameLastDigit(numbers),
      ac:            calcAC(numbers),
    };
  }


  /**
   * 주어진 범위의 모든 통계를 한 번에 계산한다.
   *
   * 분석 페이지의 차트·표에 바로 바인딩할 수 있다.
   *
   * @param   {Object[]} data
   * @param   {number}   [limit=0]
   * @returns {Object}
   */
  function analyzeAll(data, limit) {
    limit = limit || 0;
    var slice = _slice(data, limit);

    return {
      meta: {
        totalRounds: slice.length,
        limit:       limit,
        rounds:      slice.map(function (r) { return r.round; }),
      },
      frequency:           calcFrequency(data, limit),
      frequencyByRange:    calcFrequencyByRange(data),
      missing:             calcMissingNumbers(data, limit),
      longestAbsent:       calcLongestAbsent(data),
      oddEvenStats:        calcOddEvenStats(data, limit),
      lowHighStats:        calcLowHighStats(data, limit),
      sumStats:            calcSumStats(data, limit),
      lastDigitStats:      calcLastDigitStats(data, limit),
      rangeStats:          calcRangeStats(data, limit),
      consecutiveStats:    calcConsecutiveStats(data, limit),
      sameLastDigitStats:  calcSameLastDigitStats(data, limit),
      acStats:             calcACStats(data, limit),
    };
  }


  // ─────────────────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────────────────
  return {
    // 빈도
    calcFrequency:        calcFrequency,
    calcFrequencyByRange: calcFrequencyByRange,
    // 미출현
    calcMissingNumbers: calcMissingNumbers,
    calcLongestAbsent:  calcLongestAbsent,
    // 홀짝
    calcOddEvenRatio:   calcOddEvenRatio,
    calcOddEvenStats:   calcOddEvenStats,
    // 저고
    calcLowHighRatio:   calcLowHighRatio,
    calcLowHighStats:   calcLowHighStats,
    // 합계
    calcSum:      calcSum,
    calcSumStats: calcSumStats,
    // 평균 / 중앙값
    calcMean:   calcMean,
    calcMedian: calcMedian,
    // 끝수
    calcLastDigit:      calcLastDigit,
    calcLastDigitStats: calcLastDigitStats,
    // 구간
    calcRangeDistribution: calcRangeDistribution,
    calcRangeStats:        calcRangeStats,
    // 연속번호
    calcConsecutive:      calcConsecutive,
    calcConsecutiveStats: calcConsecutiveStats,
    // 동일 끝수
    calcSameLastDigit:      calcSameLastDigit,
    calcSameLastDigitStats: calcSameLastDigitStats,
    // AC값
    calcAC:      calcAC,
    calcACStats: calcACStats,
    // 종합
    analyzeRound: analyzeRound,
    analyzeAll:   analyzeAll,
  };

})();
