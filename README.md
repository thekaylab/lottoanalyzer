# LottoLens — 로또 번호 분석기

> 역대 로또 당첨 데이터를 분석하여 통계 기반으로 번호를 예측하는 Static Website

## 기술 스택

| 항목 | 내용 |
|------|------|
| 언어 | HTML5, CSS3, JavaScript (ES6+) |
| 모듈 | ES6 Native Modules (`type="module"`) |
| 배포 | GitHub Pages / Cloudflare Pages 직배포 |
| 서버 | 불필요 (Pure Static) |

---

## 프로젝트 구조

```
10-lotto-analyzer/
│
├── index.html              # 메인 HTML (단일 페이지)
│
├── css/
│   ├── style.css           # 메인 스타일 (디자인 토큰, 컴포넌트)
│   └── responsive.css      # 반응형 미디어 쿼리
│
├── js/
│   ├── app.js              # 진입점 (테마, 탭, 모바일 메뉴)
│   ├── analysis.js         # 통계 분석 (빈도, 홀짝, 고저, 연속번호)
│   ├── prediction.js       # 번호 예측 (4가지 모드)
│   ├── chart.js            # Canvas 차트 렌더링
│   ├── storage.js          # 데이터 로드 & localStorage CRUD
│   └── utils.js            # 공통 유틸 (포맷, 토스트, 디바운스...)
│
├── data/
│   └── lotto.json          # 로또 당첨 데이터 (동행복권 출처)
│
└── assets/
    ├── icons/              # SVG 아이콘
    └── images/             # 이미지 리소스
```

---

## 주요 기능 (구현 예정)

### 대시보드
- 요약 통계 카드 (총 회차, 핫/콜드 번호, 최신 회차)
- 최신 당첨 번호 볼 표시
- 번호별 출현 빈도 막대 차트
- 번호대별 분포 도넛 차트
- 핫/콜드 번호 TOP 10 순위

### 통계 분석
- 번호 빈도 히트맵 (1~45)
- 홀짝 / 고저 비율 분석
- 번호 트렌드 라인 차트
- 연속 번호 패턴 분석

### 번호 예측
- 4가지 모드: 빈도 기반 / 균형 / 랜덤 / 번호 제외
- 1~10게임 동시 생성
- 생성된 번호 저장 / 복사
- localStorage 기반 저장 목록 관리

### 당첨 이력
- 전체 회차 검색 (회차 번호 / 번호 검색)
- 정렬 및 페이지네이션
- 반응형 테이블

---

## 개발 원칙

- ✅ HTML5 시맨틱 태그
- ✅ CSS Custom Properties 기반 디자인 토큰
- ✅ ES6 모듈 (import/export)
- ✅ Mobile-First 반응형 (480px → 768px → 1024px → 1280px)
- ✅ WCAG 접근성 (aria 속성, 키보드 탐색, skip link)
- ✅ 다크/라이트 모드
- ✅ 스켈레톤 로딩 UI
- ✅ 토스트 알림

---

## 로컬 실행

서버 없이 직접 열면 ES6 모듈의 CORS 정책으로 동작하지 않을 수 있습니다.

```bash
# VS Code Live Server 확장 사용 권장
# 또는 Python 내장 서버
python -m http.server 8080

# 또는 Node.js
npx serve .
```

---

## 데이터 출처

- 동행복권 공식 사이트: https://www.dhlottery.co.kr
- `/data/lotto.json` 파일에 JSON 형식으로 저장

---

## 라이선스

MIT License
