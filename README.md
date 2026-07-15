# 🎱 LottoLens — 로또 번호 분석기

> 역대 로또 당첨 데이터를 통계 분석하여 번호를 추천하는 **무료 오픈소스 Static Website**

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github)](https://kay-lab.github.io/lottolens/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📊 **번호 분석** | 실시간 평균값, 중앙값, 미출현 번호 추적, 홀짝 및 저고 누적 비율, AC값, 연속번호/동일끝수 확률 상세 통계 분석 |
| 🤖 **번호 추천** | 5가지 알고리즘 (AI Mix, 출현빈도, 균형형, 미출현, 완전랜덤) 기반 번호 자동 생성 (A/B/C세트 대시보드 연동) |
| 📌 **번호 고정/제외** | 1~5개의 번호를 반드시 포함(고정)하거나 제외하여 최적화된 추천번호 추출 |
| ❤️ **즐겨찾기 & 기록** | 마음에 드는 번호 조합 영구 저장 및 최근 생성 기록 조회 (LocalStorage) |
| 📈 **7종 반응형 차트** | Chart.js 기반 번호별 출현빈도, 최근 추이, 홀짝 및 구간 분포 등 모바일 최적화 시각화 |
| 🌙 **다크/라이트 모드** | 시스템 모드 감지 및 사용자가 설정한 다크모드 영구 저장 (LocalStorage) |
| 🔁 **자동 데이터 업데이트** | GitHub Actions 및 스케줄러를 통한 매주 토요일 밤 로또 당첨 데이터 자동 갱신 배포 |

---

## 🛠️ 기술 스택

* **Frontend**: HTML5 (SPA, 해시 라우팅), CSS3 (Glassmorphism, 변수 기반 다크모드), Vanilla JavaScript (IIFE 패턴)
* **Visuals**: [Chart.js 4.4.4](https://www.chartjs.org/)
* **Typography**: Inter (Google Fonts)
* **Automation**: GitHub Actions (Python 3.10)
* **Deployment**: GitHub Pages (정적 호스팅)

---

## 🔁 데이터 업데이트 체계

이 프로젝트는 **자동 및 수동의 하이브리드 데이터 업데이트 체계**를 갖추고 있어, API 호출 제한이나 일시적 차단 상황에서도 항상 100% 안전하게 데이터를 최신으로 유지합니다.

### 1. 자동 업데이트 (GitHub Actions)
* 매주 토요일 오후 9:00 KST (12:00 UTC)에 GitHub Actions 가상 환경이 자동으로 켜집니다.
* `scripts/update_lotto.py`가 동행복권 공식 API를 호출하여 그날의 최신 회차를 가져옵니다.
* 변경사항이 발생하면 Actions 봇이 `data/lotto.json`을 자동으로 커밋&푸시하고 GitHub Pages가 즉시 자동 재배포됩니다.

### 2. 수동 업데이트 (공식 엑셀 파일 변환)
로컬 환경에서 개발을 진행하거나, 대량 데이터를 안전하게 일괄적으로 갱신하고 싶을 때는 동행복권 공식 엑셀 파일을 다운로드받아 변환할 수 있습니다.

1. [동행복권 공식 홈페이지 - 회차별 당첨결과](https://www.dhlottery.co.kr/gameResult.do?method=byWin)에 접속합니다.
2. 상단 조회 범위에서 **1회부터 최신 회차까지** 지정한 후 **[엑셀다운로드]**를 받습니다.
3. 다운로드받은 엑셀 파일(파일명: `로또 회차별 당첨번호_*.xlsx`)을 **프로젝트 루트 폴더**에 그대로 넣습니다.
4. 아래 변환 스크립트를 터미널에서 실행합니다 (외부 라이브러리 설치 필요 없음):
   ```bash
   python scripts/excel_to_json.py
   ```
5. 단 0.1초 만에 엑셀 데이터를 파싱하여 `data/lotto.json`을 전체 갱신하고 최신 데이터로 복구해 줍니다.

---

## 📁 프로젝트 구조

```
10-lotto-analyzer/
├── index.html              # 단일 페이지 앱 진입점 (SEO 및 OG 메타 포함)
├── robots.txt              # 검색엔진 크롤링 허용 규칙
├── sitemap.xml             # SEO 검색용 사이트맵
├── css/
│   ├── style.css           # 디자인 시스템 및 테마 정의, 레이아웃 스타일
│   └── responsive.css      # 반응형 모바일 최적화 미디어 쿼리
├── js/
│   ├── utils.js            # 공통 유틸 (포맷터, 볼 렌더러, 토스트 알림 등)
│   ├── storage.js          # LocalStorage 영구화 및 JSON 캐시 관리 (버전 무효화 지원)
│   ├── analysis.js         # 로또 통계 핵심 계산 수학 모듈
│   ├── analysis-page.js    # 번호분석 페이지 실시간 지표 렌더링 컨트롤러
│   ├── prediction.js       # 추천번호 알고리즘 5종 구현 모듈
│   ├── chart.js            # Chart.js 래퍼 (반응형 차트 7종 연동)
│   ├── recommend.js        # 추천번호 UI 인터랙션 및 상태 관리 컨트롤러
│   └── app.js              # 메인 데이터 로딩 오케스트레이터 및 네비게이션 제어
├── scripts/
│   ├── update_lotto.py     # GitHub Actions용 매주 자동 크롤러
│   └── excel_to_json.py    # 공식 엑셀 파일을 data/lotto.json으로 변환해주는 유틸
├── data/
│   └── lotto.json          # 역대 1회차부터 최신 회차까지의 정제된 당첨 데이터베이스
└── assets/
    ├── icons/
    │   └── favicon.svg     # LottoLens 고해상도 SVG 파비콘
    └── images/
        └── kay_lab_logo_transparent.png
```

---

## 🚀 로컬 실행 방법

> **⚠️ 주의:** 로컬 브라우저에서 `index.html` 파일을 직접 더블 클릭(`file://` 프로토콜)하여 열 경우, 브라우저 보안 정책에 의해 `lotto.json` 비동기 로드가 차단(CORS 오류)되어 화면에 데이터가 표시되지 않습니다.  
> 반드시 아래 웹 서버를 구동해 브라우저로 접속해 주세요.

### 1. Python 내장 웹 서버 실행
```bash
python -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

### 2. Node.js npx serve 실행
```bash
npx serve .
# 브라우저에서 http://localhost:3000 접속
```

---

## 🔒 면책 조항 (Disclaimer)

* 이 서비스는 로또 당첨 통계 정보의 시각화 및 학습용 모의 통계 분석 추천을 제공하며, **실제 로또 당첨을 예견하거나 보장하지 않습니다.**
* 복권은 당첨 확률이 고정된 무작위 게임으로, 모든 번호 조합의 수학적 당첨 확률은 동일합니다. 무리한 복권 구매는 삼가주시기 바랍니다.

---

## 📝 라이선스

MIT License © 2026 [Kay Lab](https://github.com/kay-lab)
