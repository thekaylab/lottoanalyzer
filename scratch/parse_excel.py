import zipfile
import xml.etree.ElementTree as ET
import os
import json
from datetime import datetime, timedelta

excel_file = "로또 회차별 당첨번호_20260716003306.xlsx"
target_file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'lotto.json')

# 로또 1회 추첨 기준일
START_DATE = datetime(2002, 12, 7)

def get_draw_date(round_num):
    # 회차별 날짜 역산 (1회 = 2002-12-07, 매주 7일 간격 증가)
    draw_date = START_DATE + timedelta(days=(round_num - 1) * 7)
    return draw_date.strftime("%Y-%m-%d")

def clean_int(val):
    if not val:
        return 0
    # 숫자 이외의 문자(쉼표, '명', '원', 공백) 제거
    cleaned = "".join([c for c in str(val) if c.isdigit()])
    return int(cleaned) if cleaned else 0

def parse():
    if not os.path.exists(excel_file):
        print(f"Error: {excel_file} not found!")
        return

    with zipfile.ZipFile(excel_file, 'r') as zip_ref:
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
            pass # sharedStrings가 없을 수 있음 (숫자로만 이루어진 시트 등)

        # 2. sheet1.xml 파싱
        with zip_ref.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = root.findall('.//ns:row', ns)
            
            records = []
            
            # 1행은 헤더이므로 2행(index 1)부터 데이터 파싱
            for r in rows[1:]:
                # 셀 값들을 임시 딕셔너리로 수집 (A, B, C, D...)
                row_data = {}
                for c in r.findall('ns:c', ns):
                    r_attr = c.attrib.get('r') # 예: "A2", "B2"
                    if not r_attr:
                        continue
                    col_letter = "".join([char for char in r_attr if char.isalpha()]) # "A", "B", "C" 등
                    
                    val_el = c.find('ns:v', ns)
                    val = val_el.text if val_el is not None else None
                    t_attr = c.attrib.get('t')
                    
                    if t_attr == 's' and val is not None:
                        str_idx = int(val)
                        val = shared_strings[str_idx] if str_idx < len(shared_strings) else val
                    
                    row_data[col_letter] = val
                
                # 수집된 엑셀 셀 정보를 데이터 레코드로 파싱
                # B: 회차, C~H: 당첨번호 1~6, I: 보너스 번호, K: 1등 당첨자수, L: 1등 당첨금액
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
                    # 오름차순 정렬 보장
                    numbers.sort()
                    
                    bonus = int(float(row_data.get('I', 0)))
                    winners = clean_int(row_data.get('K', 0))
                    prize = clean_int(row_data.get('L', 0))
                    
                    # 역산 추첨 날짜
                    date_str = get_draw_date(round_num)
                    
                    records.append({
                        "round": round_num,
                        "date": date_str,
                        "numbers": numbers,
                        "bonus": bonus,
                        "prize": prize,
                        "winners": winners,
                        "sales": prize * winners # 총 판매액 추정값 혹은 당첨금 총합
                    })
                except Exception as e:
                    # 헤더나 비정상 데이터 스킵
                    pass
            
            # 내림차순 정렬 (최신 회차가 맨 위로)
            records.sort(key=lambda x: x['round'], reverse=True)
            
            # JSON 작성
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
            
            os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
            with open(target_file_path, 'w', encoding='utf-8') as f:
                json.dump(lotto_data, f, ensure_ascii=False, indent=2)
                
            print(f"Success! Converted {len(records)} rounds into {target_file_path}.")
            print(f"Latest round in database: {records[0]['round']} ({records[0]['date']})")

if __name__ == '__main__':
    parse()
