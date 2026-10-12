# 팀원용 사용법 — 코딩 없이 데이터 고치기

모든 작업은 **GitHub 웹사이트에서 파일을 열고 연필(✏️) 버튼으로 고친 뒤 `Commit changes`** 만 누르면 됩니다.
저장하면 몇 분 뒤 자동으로 처리되고 사이트에 반영됩니다.

## 1. 제품 이미지 추가 (누끼 자동)
파일: `data/images/sources.csv`

```
food_cd,source_url,collected_at,note
P109-xxxxxxxx-xxxx,https://제조사사이트/제품이미지.jpg,2026-10-14,제조사 공식몰
```
- `food_cd` = 사이트 상세 화면의 **식품코드**
- `source_url` = 이미지 파일 주소 (이미지 위에서 오른쪽 클릭 → 이미지 주소 복사)
- 배경 제거·크기 조정은 자동. 지우고 싶으면 그 줄을 삭제.

## 2. 카페인 입력 (약사 확인 후)
파일: `data/samples/caffeine_labels.csv`

```
food_cd,name,caffeine_mg,label_basis,checked_by,checked_at
P109-xxxxxxxx-xxxx,콜드브루 라떼,95,1팩,이윤표,2026-10-17
```
- `caffeine_mg` 는 **1팩 기준 mg**. 포장에 100ml 기준으로 적혀 있으면 용량에 맞게 환산해서 입력.
- `checked_by` 가 비어 있어도 반영되지만, 공개 전 약사 확인을 원칙으로 합니다.

## 3. 맛 기록 입력 (시음 후)
파일: `data/samples/taste_notes.csv`

```
food_cd,name,anchor,sweet,sour,fizz,body,after,panel_n,tasted_at,note
P109-xxxxxxxx-xxxx,랩노쉬 퍼펙트 딸기,딸기우유보다 덜 달고 묽다,중,약,약,약,약,5,2026-10-24,차갑게 마시면 단맛이 줄어듦
```
- `anchor` = 널리 알려진 음료와 비교한 한 문장 (예: "포카리보다 덜 달다")
- `sweet,sour,fizz,body,after` = 단맛·산미·탄산·바디감·뒷맛을 **약/중/강** 중 하나로 (모르면 빈칸)
- 점수·별점·"맛있다/맛없다" 같은 평가는 쓰지 않습니다. 시음 음료는 팀이 직접 구매(협찬 X).

## 4. 샘플러 신청 결과 보기
Supabase 대시보드(kangsters-web 프로젝트) → Table Editor → `deukgeun_sampler_requests`(신청), `deukgeun_events`(담기·열람 이벤트). 익명 화면에서는 읽을 수 없게 막혀 있습니다.

## 5. 데이터 수동 갱신
레포 상단 **Actions** → 왼쪽 **Fetch MFDS data** → **Run workflow**. (원래는 매주 월요일 09:00 자동, 새 제품의 원재료도 함께 수집)

## 6. 숫자 확인 (회의용)
`data/processed/summary.json` — 음료 수, 1팩 기준 비율, 신규, 카페인·이미지 입력 수.

## 7. 기준을 바꾸고 싶으면
`docs/CRITERIA.md` 에 제안 → 이윤표 감수 → 김강이 코드 반영 → `docs/CHANGELOG.md` 기록.
