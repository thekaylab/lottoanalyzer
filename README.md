# 🎱 LottoLens — 로또 번호 분석기

> 역대 로또 당첨 데이터를 통계 분석하여 번호를 추천하는 **무료 오픈소스 Static Website**

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github)](https://kay-lab.github.io/lottolens/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📊 **번호 분석** | 출현 빈도, 홀짝 비율, 구간 분포, 끝수, AC값, 연속번호 등 |
| 🤖 **번호 추천** | 5가지 알고리즘 (AI Mix, 출현빈도, 균형형, 미출현, 완전랜덤) |
| 📌 **번호 고정/제외** | 특정 번호를 반드시 포함 또는 제외하여 생성 |
| ❤️ **즐겨찾기** | 마음에 드는 번호 세트 저장 (LocalStorage) |
| 📈 **7종 차트** | Chart.js 기반 반응형 시각화 |
| 🌙 **다크/라이트 모드** | 모드 전환 및 LocalStorage 저장 |
| 📱 **모바일 최적화** | Mobile-first 반응형 레이아웃, 하단 네비게이션 |

---

## 🖥️ 스크린샷

> GitHub Pages 배포 후 추가 예정

---

## 🛠️ 기술 스택

| 항목 | 사용 기술 |
|------|---------|
| 구조 | HTML5 (단일 페이지, 해시 기반 라우팅) |
| 스타일 | Vanilla CSS (CSS Custom Properties, Glassmorphism) |
| 로직 | Vanilla JavaScript (IIFE 네임스페이스, ES6+) |
| 차트 | [Chart.js 4.4.4](https://www.chartjs.org/) (CDN) |
| 폰트 | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| 배포 | GitHub Pages (Static, 서버리스) |

---

## 📁 프로젝트 구조

```
10-lotto-analyzer/
├── index.html              # 단일 페이지 앱 진입점
├── robots.txt              # 검색엔진 크롤링 허용
├── sitemap.xml             # SEO 사이트맵
├── css/
│   ├── style.css           # 메인 스타일 (Design Tokens, 컴포넌트)
│   └── responsive.css      # 반응형 미디어 쿼리 (Mobile-First)
├── js/
│   ├── utils.js            # 공통 유틸 (포맷팅, 볼 생성, 토스트 등)
│   ├── storage.js          # 데이터 로드 & 캐싱 (fetch + LocalStorage)
│   ├── analysis.js         # 통계 계산 (빈도, 홀짝, AC값 등)
│   ├── prediction.js       # 번호 생성 알고리즘 5종
│   ├── chart.js            # Chart.js 래퍼 (7종 차트)
│   ├── recommend.js        # 추천 페이지 UI & 상태 관리
│   └── app.js              # 메인 진입점 (테마, 네비, 데이터 오케스트레이션)
├── data/
│   └── lotto.json          # 회차별 당첨번호 데이터 (1200회~최신)
└── assets/
    ├── icons/
    │   └── favicon.svg     # SVG 파비콘
    └── images/
        └── kay_lab_logo_transparent.png
```

---

## 🚀 로컬 실행

> **⚠️ 중요:** `file://` 프로토콜에서는 `fetch()`가 CORS 오류로 차단됩니다.  
> 반드시 로컬 서버를 통해 실행하세요.

### Option 1: Python 내장 서버

```bash
cd 10-lotto-analyzer
python -m http.server 8080
# → http://localhost:8080 접속
```

### Option 2: Node.js serve

```bash
npx serve .
# → http://localhost:3000 접속
```

### Option 3: VS Code Live Server

VS Code에서 `index.html` 우클릭 → **Open with Live Server**

---

## 📊 데이터 업데이트 방법

1. [동행복권 공식 홈페이지](https://www.dhlottery.co.kr)에서 최신 당첨번호 확인
2. `data/lotto.json`의 `data` 배열 최상단에 새 회차 추가:

```json
{ "round": 1233, "date": "2026-07-19", "numbers": [X, X, X, X, X, X], "bonus": X }
```

3. `_last_updated` 필드를 오늘 날짜로 수정
4. (선택) `storage.js`의 `CACHE_VERSION`을 올려 기존 캐시 무효화

---

## 🔒 면책 조항

> ⚠️ 이 서비스는 **통계 분석 목적**으로만 제공됩니다.  
> 당첨을 보장하지 않으며, 과도한 복권 구매는 삼가주세요.  
> 모든 번호 추천 결과는 과거 데이터 기반 참고용입니다.

---

## 📝 라이선스

MIT License © 2026 [Kay Lab](https://github.com/kay-lab)
