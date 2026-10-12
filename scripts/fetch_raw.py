"""DR-1: 식약처 가공식품 영양성분 API에서 '음료류' 원천 데이터를 받아 data/raw/YYYY-MM-DD.json.gz 로 저장한다.

- 원천(raw)은 절대 수정하지 않는다. 가공은 normalize.py 에서만 한다.
- 응답 item 을 손대지 않고 그대로 리스트로 묶어 gzip 압축 저장 (주간 ~55MB → ~5MB).
- 실행: DATA_GO_KR_KEY=발급받은키 python3 scripts/fetch_raw.py
- API: https://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api
"""
import datetime
import gzip
import json
import os
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ENDPOINT = "https://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api"
CATEGORY = "음료류"  # 결정 3: 대분류 '음료류'만 (foodLv3Nm)
PAGE_SIZE = 1000
ROOT = pathlib.Path(__file__).resolve().parent.parent


def fetch_page(key: str, page: int) -> dict:
    params = {
        "serviceKey": key,
        "pageNo": page,
        "numOfRows": PAGE_SIZE,
        "type": "json",
        "foodLv3Nm": CATEGORY,
    }
    url = ENDPOINT + "?" + urllib.parse.urlencode(params, safe="%")
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                text = r.read().decode("utf-8", errors="replace")
            break
        except Exception as e:  # 네트워크 일시 오류 재시도
            last = e
            time.sleep(3 * (attempt + 1))
    else:
        sys.exit(f"요청 실패 page {page}: {last}")
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        sys.exit(f"JSON 아님 (키 미등록·트래픽 초과 등): {text[:500]}")
    if "response" in body:  # 구형 래핑
        body = body["response"]
    if "header" not in body:
        sys.exit(f"예상과 다른 응답: {json.dumps(body, ensure_ascii=False)[:500]}")
    return body


def extract_items(res: dict) -> list:
    items = res.get("items") or []
    if isinstance(items, dict):
        items = items.get("item") or []
    if isinstance(items, dict):
        items = [items]
    return items


def main() -> None:
    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        sys.exit("DATA_GO_KR_KEY 환경변수가 없습니다.")
    today = datetime.date.today().isoformat()
    out_dir = ROOT / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)

    page, total, items_all = 1, None, []
    while True:
        body = fetch_page(key, page)
        header = body["header"]
        if header["resultCode"] not in ("00", "03"):
            sys.exit(f"API 오류 {header['resultCode']}: {header['resultMsg']}")
        res = body.get("body") or {}
        total = int(res.get("totalCount", 0))
        items = extract_items(res)
        items_all.extend(items)
        print(f"page {page}: {len(items)}건 (누적 {len(items_all)}/{total})")
        if len(items_all) >= total or not items:
            break
        page += 1
        time.sleep(0.3)

    if total and len(items_all) < total * 0.98:
        sys.exit(f"수집 누락 의심: {len(items_all)}/{total} — 저장하지 않음")

    payload = {
        "meta": {
            "fetched_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "endpoint": ENDPOINT,
            "filter": {"foodLv3Nm": CATEGORY},
            "total_count": total,
            "saved": len(items_all),
        },
        "items": items_all,
    }
    dest = out_dir / f"{today}.json.gz"
    with gzip.open(dest, "wt", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"완료: {len(items_all)}건 → {dest} ({dest.stat().st_size/1e6:.1f}MB)")


if __name__ == "__main__":
    main()
