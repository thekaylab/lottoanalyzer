import os
import json
import urllib.request
import urllib.error
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

target_file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'lotto.json')
latest_round = 1232
max_workers = 6  # 안정성을 최우선으로 낮춘 스레드 수
batch_limit = 400  # 한 번 실행할 때 최대 수집할 회차 수 (안정성을 위해 제한)

def fetch_round(round_num):
    url = f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={round_num}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=6) as response:
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
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return None

def main():
    print("Incremental lotto data fetching start...")
    results = {}
    
    # 1. 기존 파일 로드
    if os.path.exists(target_file_path):
        try:
            with open(target_file_path, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                if isinstance(old_data, dict) and "data" in old_data:
                    for item in old_data["data"]:
                        if "round" in item and "numbers" in item and len(item["numbers"]) == 6:
                            results[item["round"]] = item
            print(f"Cached data loaded: {len(results)} rounds.")
        except Exception as e:
            print("Failed to load existing json, start fresh.", e)

    # 2. 미수집 회차 필터링
    rounds_to_fetch = [r for r in range(1, latest_round + 1) if r not in results]
    print(f"Total missing rounds in database: {len(rounds_to_fetch)}")

    if not rounds_to_fetch:
        print("Database is already complete! No action needed.")
        return

    # 안정성을 위해 이번 회기에는 batch_limit 개수만큼만 수집 진행
    rounds_to_fetch = rounds_to_fetch[:batch_limit]
    print(f"Fetching this batch: {len(rounds_to_fetch)} rounds (Rounds: {rounds_to_fetch[0]} ~ {rounds_to_fetch[-1]})")

    # 3. 병렬 수집 진행
    success_count = 0
    chunk_size = 30
    for i in range(0, len(rounds_to_fetch), chunk_size):
        chunk = rounds_to_fetch[i:i+chunk_size]
        print(f"Fetching chunk {chunk[0]} ~ {chunk[-1]}...")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(fetch_round, r): r for r in chunk}
            for future in as_completed(futures):
                r_num = futures[future]
                res = future.result()
                if res:
                    results[r_num] = res
                    success_count += 1
                else:
                    print(f"[Error] Failed round {r_num}")
        
        # API 부하 방지 대기
        time.sleep(1.2)

    # 4. 파일 저장
    final_list = list(results.values())
    final_list.sort(key=lambda x: x['round'], reverse=True)
    
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
        "data": final_list
    }
    
    os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
    with open(target_file_path, 'w', encoding='utf-8') as f:
        json.dump(lotto_data, f, ensure_ascii=False, indent=2)
        
    print(f"Batch completed! Successfully fetched {success_count} rounds.")
    print(f"Current database contains {len(final_list)} / {latest_round} rounds.")

if __name__ == '__main__':
    main()
