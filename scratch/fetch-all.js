const fs = require('fs');
const https = require('https');
const path = require('path');

const targetFilePath = path.join(__dirname, '..', 'data', 'lotto.json');
const latestRound = 1232;
const concurrencyLimit = 30; // 동시 요청 수 제한

// API 호출 헬퍼
function fetchRound(round) {
  return new Promise((resolve, reject) => {
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.returnValue === 'success') {
            resolve({
              round: json.drwNo,
              date: json.drwNoDate,
              numbers: [
                json.drwtNo1,
                json.drwtNo2,
                json.drwtNo3,
                json.drwtNo4,
                json.drwtNo5,
                json.drwtNo6
              ].map(Number).sort((a, b) => a - b),
              bonus: Number(json.bonusNo),
              prize: Number(json.firstWinamnt || 0),
              winners: Number(json.firstPrzewinnerCo || 0),
              sales: Number(json.totSellamnt || 0)
            });
          } else {
            reject(new Error(`Fail to fetch round ${round}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// 청크로 나누어 병렬 처리
async function fetchAll() {
  console.log(`1회부터 ${latestRound}회까지 로또 데이터 수집을 시작합니다...`);
  const results = [];
  const rounds = Array.from({ length: latestRound }, (_, i) => i + 1);

  for (let i = 0; i < rounds.length; i += concurrencyLimit) {
    const chunk = rounds.slice(i, i + concurrencyLimit);
    console.log(`요청 진행 중: ${chunk[0]}회 ~ ${chunk[chunk.length - 1]}회...`);
    
    const promises = chunk.map(r => 
      fetchRound(r).catch(err => {
        console.error(`[오류] ${r}회차 가져오기 실패, 재시도합니다...`, err.message);
        // 재시도 1회
        return new Promise(res => setTimeout(res, 1000))
          .then(() => fetchRound(r))
          .catch(e => {
            console.error(`[오류] ${r}회차 최종 실패:`, e.message);
            return null;
          });
      })
    );

    const chunkResults = await Promise.all(promises);
    chunkResults.forEach(res => {
      if (res) results.push(res);
    });
    
    // API 서버 과부하 방지를 위한 약간의 대기
    await new Promise(res => setTimeout(res, 200));
  }

  // 내림차순 정렬 (최신이 위로)
  results.sort((a, b) => b.round - a.round);

  const lottoData = {
    _schema: {
      round: "회차 번호 (number)",
      date: "추첨 날짜 ISO 8601 (string: YYYY-MM-DD)",
      numbers: "당첨 번호 6개 오름차순 (number[])",
      bonus: "보너스 번호 (number)",
      prize: "1등 당첨금 (number)",
      winners: "1등 당첨자수 (number)",
      sales: "총 판매액 (number)"
    },
    _source: "동행복권 (https://www.dhlottery.co.kr)",
    _last_updated: new Date().toISOString().split('T')[0],
    data: results
  };

  fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
  fs.writeFileSync(targetFilePath, JSON.stringify(lottoData, null, 2), 'utf-8');
  console.log(`수집 완료! 총 ${results.length}개의 데이터가 ${targetFilePath}에 저장되었습니다.`);
}

fetchAll().catch(console.error);
