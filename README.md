# 청담음료 (가칭)

시중 제로·고단백·기능성 음료를 **성분 숫자로** 나란히 비교하는 웹 MVP.
KAIST IT경영 특수논제 Ⅰ 8조 팀 프로젝트 · 헬창(운동인) 버전.

- 요구사항: 헬창 버전 MVP 요구사항 정의서 (2026-10-10, 초안)
- 화면 시안: [Figma — 헬창 MVP 화면 시안 v0.1](https://www.figma.com/design/lT0upshzJ1sXHz815V4KUq)

## 폴더
| 경로 | 내용 |
|---|---|
| `scripts/fetch_raw.py` | 식약처 가공식품 영양성분 API에서 **음료류** 원천 수집 → `data/raw/날짜/` |
| `scripts/normalize.py` | 원천 → `data/processed/drinks.json` (1팩 환산, 커버리지 출력) |
| `data/raw/` | 원천. **수정 금지** (DR-1) |
| `data/samples/` | 골든셋 100개, 카페인 수동 입력 (DR-3) |
| `data/images/source/` | 제조사 원본 이미지 + 출처 기록 |
| `data/images/cutout/` | 배경 제거(누끼) 결과 |
| `docs/` | SCHEMA · CRITERIA · CHANGELOG |
| `.github/workflows/fetch.yml` | 매주 월요일 자동 수집 |

## 데이터 수집 실행
1. 레포 Settings → Secrets and variables → Actions → `DATA_GO_KR_KEY`에 공공데이터포털 인증키(Decoding) 저장
2. Actions 탭 → **Fetch MFDS data** → Run workflow (이후 매주 자동)

로컬 실행: `DATA_GO_KR_KEY=... python3 scripts/fetch_raw.py && python3 scripts/normalize.py`
