# 청담음료 (가칭)

시중 제로·고단백·기능성 음료를 **성분 숫자로** 나란히 비교하는 웹 MVP.
KAIST IT경영 특수논제 Ⅰ 8조 팀 프로젝트 · 헬창(운동인) 버전.

- 요구사항: 헬창 버전 MVP 요구사항 정의서 (2026-10-10, 초안)
- 화면 시안: [Figma — 헬창 MVP 화면 시안 v0.1](https://www.figma.com/design/lT0upshzJ1sXHz815V4KUq)
- 팀원 사용법(코딩 없이 이미지·카페인 입력): [docs/HOWTO-팀원.md](docs/HOWTO-팀원.md)

## 요구사항 구현 현황
| ID | 내용 | 상태 | 위치 |
|---|---|---|---|
| FR-1 | 음료 목록 (제품명·제조사·단백질/당류/카페인) | ✅ | `web/components/ListView.tsx` |
| FR-2 | 필터 3종 | ✅ (카페인은 데이터 입력 대기) | `web/lib/filters.ts` |
| FR-3 | 성분 상세 + 출처·수집일 | ✅ | `web/components/DetailView.tsx` |
| FR-4 | 스펙 비교 (최대 4개, 순위 없음) | ✅ | `web/components/CompareView.tsx` |
| FR-5 | 검색 + "DB에 없는 제품" 안내 | ✅ | `ListView.tsx` |
| FR-6 | 프리셋 필터 (필터 조합 안내 문구) | ✅ | `web/lib/filters.ts` |
| FR-7 | 업데이트 일자 · NEW 표시 | ✅ | 상단 업데이트 바 |
| FR-8 | 성분 용어 설명 | ✅ 초안 (약사 감수 대기) | `web/lib/glossary.ts` |
| FR-9 | 이메일 알림 신청 | ⏸ 랜딩에서 처리 | – |
| FR-10 | 비교표 URL 공유 | ✅ | 비교 화면 '링크 복사' |
| DR-1 | 원천 날짜별 보관 | ✅ | `data/raw/` |
| DR-2 | 필터 정의 문서 | ✅ v0.2 | `docs/CRITERIA.md` |
| DR-3 | 골든셋 100개 회귀 테스트 | ⏳ 샘플 파일 필요 | `data/samples/` |
| DR-4 | 스키마 | ✅ v0.2 | `docs/SCHEMA.md` |
| DR-5 | 변경 이력 | ✅ | `docs/CHANGELOG.md` |

## 폴더
| 경로 | 내용 |
|---|---|
| `scripts/fetch_raw.py` | 식약처 API → `data/raw/날짜.json.gz` (원천, 수정 금지) |
| `scripts/normalize.py` | 원천 → 정제본·요약·웹 데이터 (범위·기준 규칙 R1~R5) |
| `scripts/images.py` | 이미지 URL → 다운로드 → 배경 제거(rembg) → `web/public/img/` |
| `web/` | Next.js 정적 사이트 (목록·상세·비교·분석 방법) |
| `.github/workflows/fetch.yml` | 매주 월 09:00 자동 수집 |
| `.github/workflows/rebuild.yml` | 이미지·카페인 CSV 수정 시 자동 재생성 |

## 로컬 실행
```bash
# 데이터
DATA_GO_KR_KEY=... python3 scripts/fetch_raw.py && python3 scripts/normalize.py
# 웹
cd web && npm install && npm run dev   # http://localhost:3000
npm run build                          # 정적 파일 → web/out
```
