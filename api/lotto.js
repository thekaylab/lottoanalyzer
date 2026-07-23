export const config = {
  regions: ['icn1'],
};

export default async function handler(req, res) {
  const { drwNo } = req.query;
  if (!drwNo) {
    return res.status(400).json({ error: 'drwNo parameter is required' });
  }

  try {
    const timestamp = Date.now();
    const targetUrl = `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${drwNo}&_=${timestamp}`;
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const rawData = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (!rawData || !rawData.data || !rawData.data.list || rawData.data.list.length === 0) {
      return res.status(200).json({ returnValue: 'fail' });
    }

    const item = rawData.data.list[0];
    
    // YYYYMMDD -> YYYY-MM-DD
    const rawDate = String(item.ltRflYmd || '');
    const formattedDate = rawDate.length === 8 
      ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`
      : rawDate;

    // 기존 API 파싱 포맷과 동일하게 하위 호환 매핑하여 리턴
    const legacyFormat = {
      returnValue: 'success',
      drwNo: item.ltEpsd,
      drwNoDate: formattedDate,
      drwtNo1: item.tm1WnNo,
      drwtNo2: item.tm2WnNo,
      drwtNo3: item.tm3WnNo,
      drwtNo4: item.tm4WnNo,
      drwtNo5: item.tm5WnNo,
      drwtNo6: item.tm6WnNo,
      bonusNo: item.bnsWnNo,
      firstWinamnt: item.rnk1WnAmt || 0,
      firstPrzwnerCo: item.rnk1WnNope || 0,
      totSellamnt: item.wholEpsdSumNtslAmt || 0
    };

    return res.status(200).json(legacyFormat);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
