import os
import json
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

# 로또 1회 추첨 기준일 (2002-12-07)
START_DATE = datetime(2002, 12, 7)

def get_draw_date(round_num):
    draw_date = START_DATE + timedelta(days=(round_num - 1) * 7)
    return draw_date.strftime("%Y-%m-%d")

def clean_int(val):
    if not val:
        return 0
    cleaned = "".join([c for c in str(val) if c.isdigit()])
    return int(cleaned) if cleaned else 0

def convert_excel_to_json(excel_path, target_json_path):
    if not os.path.exists(excel_path):
        print(f"[Error] Excel file not found at: {excel_path}")
        return False

    print(f"Reading excel file: {excel_path} ...")
    
    with zipfile.ZipFile(excel_path, 'r') as zip_ref:
        # 1. sharedStrings 로드
        shared_strings = []
        try:
            with zip_ref.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for t in root.findall('.//ns:t', ns):
                    shared_strings.append(t.text)
        except Exception:
            pass 

        # 2. sheet1.xml 파싱
        with zip_ref.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = root.findall('.//ns:row', ns)
            
            records = []
            
            # 1행은 헤더이므로 2행부터 데이터 파싱
            for r in rows[1:]:
                row_data = {}
                for c in r.findall('ns:c', ns):
                    r_attr = c.attrib.get('r')
                    if not r_attr:
                        continue
                    col_letter = "".join([char for char in r_attr if char.isalpha()])
                    
                    val_el = c.find('ns:v', ns)
                    val = val_el.text if val_el is not None else None
                    t_attr = c.attrib.get('t')
                    
                    if t_attr == 's' and val is not None:
                        str_idx = int(val)
                        val = shared_strings[str_idx] if str_idx < len(shared_strings) else val
                    
                    row_data[col_letter] = val
                
                try:
                    round_num = int(float(row_data.get('B', 0)))
                    if round_num <= 0:
                        continue
                    
                    numbers = [
                        int(float(row_data.get('C', 0))),
                        int(float(row_data.get('D', 0))),
                        int(float(row_data.get('E', 0))),
                        int(float(row_data.get('F', 0))),
                        int(float(row_data.get('G', 0))),
                        int(float(row_data.get('H', 0)))
                    ]
                    numbers.sort()
                    
                    bonus = int(float(row_data.get('I', 0)))
                    winners = clean_int(row_data.get('K', 0))
                    prize = clean_int(row_data.get('L', 0))
                    date_str = get_draw_date(round_num)
                    
                    records.append({
                        "round": round_num,
                        "date": date_str,
                        "numbers": numbers,
                        "bonus": bonus,
                        "prize": prize,
                        "winners": winners,
                        "sales": prize * winners
                    })
                except Exception:
                    pass
            
            # 내림차순 정렬 (최신이 맨 위)
            records.sort(key=lambda x: x['round'], reverse=True)
            
            lotto_data = {
                "_schema": {
                    "round": "회차 번호 (number)",
                    "date": "추첨 날짜 ISO 8601 (string: YYYY-MM-DD)",
                    "numbers": "당첨 번호 6개 오름차순 (number[])",
                    "bonus": "보너스 번호 (number)",
                    "prize": "1등 당첨금 (number)",
                    "winners": "1등 당첨자수 (number)",
                    "sales": "1등 당첨금 총합 (number)"
                },
                "_source": "동행복권 엑셀 데이터 파일 변환",
                "_last_updated": datetime.now().strftime("%Y-%m-%d"),
                "data": records
            }
            
            os.makedirs(os.path.dirname(target_json_path), exist_ok=True)
            with open(target_json_path, 'w', encoding='utf-8') as f:
                json.dump(lotto_data, f, ensure_ascii=False, indent=2)
                
            print(f"[Success] Converted {len(records)} rounds into {target_json_path}.")
            return True

if __name__ == '__main__':
    # 디렉토리 내 엑셀 파일 자동 검색 및 실행
    files = [f for f in os.listdir('.') if f.startswith('로또 회차별 당첨번호') and f.endswith('.xlsx')]
    if files:
        excel_path = files[0]
        target_json = os.path.join('data', 'lotto.json')
        convert_excel_to_json(excel_path, target_json)
    else:
        print("[Error] No file matches '로또 회차별 당첨번호*.xlsx' in root directory.")
