export default async function handler(req, res) {
  const { drwNo } = req.query;
  if (!drwNo) {
    return res.status(400).json({ error: 'drwNo parameter is required' });
  }

  try {
    const response = await fetch(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      }
    });

    const data = await response.json();
    
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
