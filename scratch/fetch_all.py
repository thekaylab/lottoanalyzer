import os
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# 설정
target_file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'lotto.json')
latest_round = 1232
concurrency_limit = 25

def fetch_round(round_num):
    url = f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={round_num}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read().decode('utf-8')
            res = json.loads(data)
            if res.get('returnValue') == 'success':
                numbers = [
                    res.get('drwtNo1'),
                    res.get('drwtNo2'),
                    res.get('drwtNo3'),
                    res.get('drwtNo4'),
                    res.get('drwtNo5'),
                    res.get('drwtNo6')
                ]
                # 정수형 정렬
                numbers = sorted([int(n) for n in numbers])
                return {
                    "round": int(res.get('drwNo')),
                    "date": res.get('drwNoDate'),
                    "numbers": numbers,
                    "bonus": int(res.get('bonusNo')),
                    "prize": int(res.get('firstWinamnt', 0)),
                    "winners": int(res.get('firstPrzewinnerCo', 0)),
                    "sales": int(res.get('totSellamnt', 0))
                }
    except Exception as e:
        print(f"[오류] {round_num}회차 가져오기 실패: {e}")
    return None

def main():
    print(f"1회부터 {latest_round}회까지 전체 로또 데이터를 동행복권 API에서 가져오는 중...")
    results = []
    
    # 멀티스레딩으로 빠른 속도로 수집
    with ThreadPoolExecutor(max_workers=concurrency_limit) as executor:
        futures = {executor.submit(fetch_round, r): r for r in range(1, latest_round + 1)}
        for future in as_completed(futures):
            round_num = futures[future]
            res = future.result()
            if res:
                results.append(res)
                if len(results) % 100 == 0:
                    print(f"진행 완료: {len(results)}개 회차 수집 완료...")
            else:
                # 간단한 재시도 1회
                print(f"{round_num}회차 재시도 중...")
                res_retry = fetch_round(round_num)
                if res_retry:
                    results.append(res_retry)
                
    # 내림차순 정렬 (최신 회차가 맨 위로)
    results.sort(key=lambda x: x['round'], reverse=True)
    
    lotto_data = {
        "_schema": {
            "round": "회차 번호 (number)",
            "date": "추첨 날짜 ISO 8601 (string: YYYY-MM-DD)",
            "numbers": "당첨 번호 6개 오름차순 (number[])",
            "bonus": "보너스 번호 (number)",
            "prize": "1등 당첨금 (number)",
            "winners": "1등 당첨자수 (number)",
            "sales": "총 판매액 (number)"
        },
        "_source": "동행복권 (https://www.dhlottery.co.kr)",
        "_last_updated": datetime.now().strftime("%Y-%m-%d"),
        "data": results
    }
    
    os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
    with open(target_file_path, 'w', encoding='utf-8') as f:
        json.dump(lotto_data, f, ensure_ascii=False, indent=2)
        
    print(f"성공! 총 {len(results)}개의 회차 정보가 {target_file_path}에 저장되었습니다.")

if __name__ == '__main__':
    main()
