import os
import json
import urllib.request
import urllib.error
import time
from datetime import datetime

# 파일 경로 설정
target_file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'lotto.json')

def fetch_round(round_num, vercel_base_url=""):
    # Vercel 릴레이 주소가 있으면 우선 사용, 없으면 동행복권 직접 호출
    if vercel_base_url:
        url = f"{vercel_base_url.rstrip('/')}/api/lotto?drwNo={round_num}"
    else:
        url = f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={round_num}"

    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
        })
        with urllib.request.urlopen(req, timeout=8) as response:
            data = response.read().decode('utf-8', errors='ignore')
            if not data.strip().startswith('{'):
                print(f"[Warning] Round {round_num}: Response is not JSON (Blocked by dhlottery WAF or HTML returned).")
                return None

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
                    "winners": int(res.get('firstPrzwnerCo', 0)),
                    "sales": int(res.get('totSellamnt', 0))
                }
    except Exception as e:
        print(f"[Error] Failed to fetch round {round_num}: {e}")
    return None

def main():
    print("[GitHub Actions] Checking for lotto data updates...")
    
    # 1. 기존 데이터 읽기
    if not os.path.exists(target_file_path):
        print(f"[Error] {target_file_path} not found. Please run full scraping first.")
        return
        
    with open(target_file_path, 'r', encoding='utf-8') as f:
        lotto_data = json.load(f)
        
    current_data = lotto_data.get("data", [])
    if not current_data:
        print("[Error] Existing data is empty.")
        return
        
    # 기존 최신 회차 확인
    latest_saved_round = max(item["round"] for item in current_data)
    print(f"Current saved latest round: {latest_saved_round}")
    
    # 2. 다음 회차부터 최신 회차까지 순차 수집
    next_round = latest_saved_round + 1
    new_records = []
    
    # Vercel 릴레이 URL (기본값: https://lottoanalyzer-rho.vercel.app)
    DEFAULT_VERCEL_URL = "https://lottoanalyzer-rho.vercel.app"
    vercel_url = os.environ.get("VERCEL_RELAY_URL", DEFAULT_VERCEL_URL).strip()
    if vercel_url:
        print(f"Using Vercel relay URL: {vercel_url}")

    while True:
        print(f"Checking round {next_round}...")
        res = fetch_round(next_round, vercel_url)
        if res:
            new_records.append(res)
            print(f"-> Round {next_round} success: {res['numbers']} / bonus {res['bonus']}")
            next_round += 1
            time.sleep(0.5) # API 부하 방지
        else:
            print(f"-> Round {next_round} result not available yet or blocked. Ending update check.")
            break
            
    # 3. 새로운 데이터가 있는 경우 갱신
    github_output = os.environ.get('GITHUB_OUTPUT')
    if new_records:
        new_records.sort(key=lambda x: x['round'], reverse=True)
        updated_data = new_records + current_data
        
        lotto_data["data"] = updated_data
        lotto_data["_last_updated"] = datetime.now().strftime("%Y-%m-%d")
        
        with open(target_file_path, 'w', encoding='utf-8') as f:
            json.dump(lotto_data, f, ensure_ascii=False, indent=2)
            
        print(f"Success! {len(new_records)} new rounds updated. (Latest: {new_records[0]['round']})")
        if github_output:
            with open(github_output, 'a') as fh:
                print("updated=true", file=fh)
    else:
        print("Already up to date. No updates needed.")
        if github_output:
            with open(github_output, 'a') as fh:
                print("updated=false", file=fh)


if __name__ == '__main__':
    main()
