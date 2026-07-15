import zipfile
import xml.etree.ElementTree as ET
import os

excel_file = "로또 회차별 당첨번호_20260716003306.xlsx"

def inspect():
    if not os.path.exists(excel_file):
        print("Excel file not found!")
        return

    with zipfile.ZipFile(excel_file, 'r') as zip_ref:
        # sharedStrings 읽기
        shared_strings = []
        try:
            with zip_ref.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                root = tree.getRoot() if hasattr(tree, 'getRoot') else tree.getroot()
                # xml 네임스페이스 정의
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for t in root.findall('.//ns:t', ns):
                    shared_strings.append(t.text)
            print(f"Loaded {len(shared_strings)} shared strings.")
            print("First 30 strings:", shared_strings[:30])
        except Exception as e:
            print("Shared strings read error:", e)

        # sheet1.xml 상단 15행 가량 셀 데이터 구조 파악
        try:
            with zip_ref.open('xl/worksheets/sheet1.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                rows = root.findall('.//ns:row', ns)
                print(f"Total rows in sheet1: {len(rows)}")
                
                for r in rows[:15]:
                    row_idx = r.attrib.get('r')
                    cells = []
                    for c in r.findall('ns:c', ns):
                        val_el = c.find('ns:v', ns)
                        val = val_el.text if val_el is not None else None
                        t_attr = c.attrib.get('t')
                        
                        # 텍스트 형태(s = shared string index)인 경우 디코딩
                        if t_attr == 's' and val is not None:
                            str_idx = int(val)
                            val = shared_strings[str_idx] if str_idx < len(shared_strings) else f"S_{val}"
                        cells.append(f"{c.attrib.get('r')}:{val}")
                    print(f"Row {row_idx}: {cells}")
        except Exception as e:
            print("Sheet1 read error:", e)

if __name__ == '__main__':
    inspect()
