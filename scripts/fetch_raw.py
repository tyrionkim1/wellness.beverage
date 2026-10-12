"""DR-1: 식약처 가공식품 영양성분 API에서 '음료류' 원천 데이터를 받아 data/raw/YYYY-MM-DD/ 에 그대로 저장한다.

- 원천(raw)은 절대 수정하지 않는다. 가공은 normalize.py 에서만 한다.
- 실행: DATA_GO_KR_KEY=발급받은키 python3 scripts/fetch_raw.py
- API: https://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api
"""
import datetime
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


def fetch_page(key: str, page: int) -> dict:
    params = {
        "serviceKey": key,
        "pageNo": page,
        "numOfRows": PAGE_SIZE,
        "type": "json",
        "foodLv3Nm": CATEGORY,
    }
    url = ENDPOINT + "?" + urllib.parse.urlencode(params, safe="%")
    with urllib.request.urlopen(url, timeout=60) as r:
        text = r.read().decode("utf-8", errors="replace")
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        sys.exit(f"JSON 아님 (키 미등록·트래픽 초과 등): {text[:500]}")
    if "response" not in body:
        sys.exit(f"예상과 다른 응답: {json.dumps(body, ensure_ascii=False)[:500]}")
    return body


def main() -> None:
    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        sys.exit("DATA_GO_KR_KEY 환경변수가 없습니다.")
    today = datetime.date.today().isoformat()
    out = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw" / today
    out.mkdir(parents=True, exist_ok=True)

    page, total, saved = 1, None, 0
    while True:
        body = fetch_page(key, page)
        header = body["response"]["header"]
        if header["resultCode"] not in ("00", "03"):
            sys.exit(f"API 오류 {header['resultCode']}: {header['resultMsg']}")
        res = body["response"]["body"]
        total = int(res.get("totalCount", 0))
        items = res.get("items") or []
        (out / f"page_{page:03d}.json").write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
        saved += len(items)
        print(f"page {page}: {len(items)}건 (누적 {saved}/{total})")
        if saved >= total or not items:
            break
        page += 1
        time.sleep(0.3)

    (out / "_meta.json").write_text(json.dumps({
        "fetched_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "endpoint": ENDPOINT,
        "filter": {"foodLv3Nm": CATEGORY},
        "total_count": total,
        "saved": saved,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"완료: {saved}건 → {out}")


if __name__ == "__main__":
    main()
