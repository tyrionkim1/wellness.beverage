# SCHEMA.md — drinks.json 스키마 (초안 v0.1)

담당: 김강 · 협력: 이윤표 · 최종 수정: 2026-10-12

## 원칙
- 원천(`data/raw/날짜/`)은 수정하지 않는다. 가공은 `scripts/normalize.py`로만, 재현 가능하게.
- 빈 값은 `null` = 화면에 "정보 없음". **0과 null은 다르다.** 추정해서 채우지 않는다 (NFR-3).
- 화면 기본값은 **1팩 기준**, 상세에 100ml(100g) 기준 병기 (결정 2, 10/12).

## 필드
| 키 | 타입 | 단위 | 원천 필드 | 예시 | 비고 |
|---|---|---|---|---|---|
| id | string | – | foodCd | P107-… | 식약처 식품코드 |
| name | string | – | foodNm | 프로틴 워터 레몬 | |
| maker | string? | – | mfrNm | (주)OO | "해당없음" → null |
| importer | string? | – | imptNm | | 수입품만 |
| category | string[] | – | foodLv4Nm, foodLv6Nm | | 대분류는 전부 "음료류" |
| basis | string | – | nutConSrtrQua | 100ml | 원천 기준량 |
| pack.size / pack.unit | number? / "ml"·"g" | – | foodSize | 330 / ml | 못 읽으면 null |
| per100.* | number? | 아래 | enerc… | | 원천 그대로 |
| per_pack.* | number? | 아래 | 계산값 | | per100 × size ÷ 100, 소수 1자리 |
| caffeine_mg | number? | mg | **없음** | 95 | 제품 표시사항에서 수동 입력 (결정 1) |
| caffeine_source | "label"? | – | – | label | null이면 "정보 없음" |
| report_no | string | – | itemMnftrRptNo | | 품목제조보고번호 |
| source | string | – | srcNm | 식품의약품안전처 | 상세 화면 출처 표기 (FR-3) |
| data_base_date | date | – | crtrYmd | 2026-09-29 | "데이터 기준일" |
| collected | date | – | 수집일 | 2026-10-12 | "수집일", 목록의 업데이트 일자 (FR-7) |

영양성분 키: `kcal`(kcal), `protein_g`, `sugar_g`, `carb_g`, `fat_g`, `sat_fat_g`, `trans_fat_g`(g), `cholesterol_mg`, `sodium_mg`(mg)

## 카페인 입력 파일
`data/samples/caffeine_labels.csv` — 컬럼: `food_cd, name, caffeine_mg, label_basis(1팩/100ml), checked_by, checked_at`
- 1팩 기준으로 환산해 입력. 약사(이윤표) 확인 후 `checked_by` 기입.
