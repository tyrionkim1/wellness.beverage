"""원재료 수집 — 식품안전나라 C002 '식품(첨가물)품목제조보고(원재료)' API.

- 품목제조보고번호(report_no)로 원재료명(RAWMTRL_NM)을 조회해 data/ingredients/cache.json.gz 에 누적 저장.
- 이미 받은 번호는 건너뛰므로 여러 번 나눠 실행해도 된다 (--limit).
- 인증키: 환경변수 FOODSAFETY_KEY (식품안전나라 회원가입 → 인증키 신청). 없으면 테스트용 'sample' 키.
- 원재료 → 태그 변환 규칙은 scripts/normalize.py 의 INGREDIENT_RULES (docs/CRITERIA.md R6).

실행: python3 scripts/ingredients.py [--limit 5000] [--workers 4]
"""
import argparse
import concurrent.futures as cf
import datetime
import gzip
import json
import os
import re
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "ingredients" / "cache.json.gz"
WEB = ROOT / "web" / "public" / "data" / "drinks.min.json"
BASE = "http://openapi.foodsafetykorea.go.kr/api/{key}/C002/json/1/5/PRDLST_REPORT_NO={no}"


def load_cache() -> dict:
    if CACHE.exists():
        with gzip.open(CACHE, "rt", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE, "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
        gz.write(json.dumps(cache, ensure_ascii=False, sort_keys=True).encode("utf-8"))


def fetch(key: str, no: str):
    url = BASE.format(key=key, no=urllib.parse.quote(no))
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                j = json.loads(r.read().decode("utf-8", errors="replace"))
            body = j.get("C002") or {}
            code = (body.get("RESULT") or {}).get("CODE", "")
            rows = body.get("row") or []
            if code == "INFO-200":  # 해당 데이터 없음 (확정)
                return {"raw": None, "checked": datetime.date.today().isoformat()}
            if code in ("INFO-300", "INFO-310", "INFO-320", "INFO-100", "ERROR-300", "ERROR-310"):
                # 인증키 오류·호출 한도 초과 → 재시도해도 소용없음. 다음 실행 때 다시 조회
                return {"error": code, "limit": True, "msg": (body.get("RESULT") or {}).get("MSG", "")[:80]}
            if not code.startswith("INFO-000") or not rows:
                raise RuntimeError(code or "empty")
            # 같은 번호로 여러 행이면 가장 최근 변경본
            row = sorted(rows, key=lambda x: x.get("CHNG_DT") or "")[-1]
            return {
                "raw": row.get("RAWMTRL_NM"),
                "name": row.get("PRDLST_NM"),
                "changed": row.get("CHNG_DT"),
                "checked": datetime.date.today().isoformat(),
            }
        except Exception as e:  # 일시 오류 재시도
            last = e
            time.sleep(2 * (attempt + 1))
    return {"error": str(last)}


def probe(key: str) -> None:
    """CHNG_DT(변경일자) 파라미터 동작 확인용 — 4회만 호출."""
    base = "http://openapi.foodsafetykorea.go.kr/api/{k}/C002/json/1/3/{q}"
    for q in ["PRDLST_REPORT_NO=2017038506015&CHNG_DT=19000101", "PRDLST_REPORT_NO=2017038506015/CHNG_DT=19000101",
              "CHNG_DT=20261001", "CHNG_DT=20260101"]:
        try:
            with urllib.request.urlopen(base.format(k=key, q=q), timeout=30) as r:
                j = json.loads(r.read().decode("utf-8", errors="replace"))
            b = j.get("C002") or {}
            rows = b.get("row") or []
            print(q, "|", b.get("RESULT"), "| total", b.get("total_count"), "|", [(x.get("PRDLST_REPORT_NO"), x.get("CHNG_DT")) for x in rows][:3])
        except Exception as e:
            print(q, "| ERR", e)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=100000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--max-minutes", type=float, default=0, help="이 시간이 지나면 저장하고 멈춤 (0=제한 없음). 남은 건 다음 실행")
    ap.add_argument("--probe", action="store_true")
    a = ap.parse_args()
    key = os.environ.get("FOODSAFETY_KEY") or "sample"
    if a.probe:
        return probe(key)
    web = json.loads(WEB.read_text(encoding="utf-8"))
    cols = web["cols"]
    ci = cols.index("reportNo")
    ix = {k: i for i, k in enumerate(cols)}
    # 국내 품목제조보고번호(숫자)만. 수입식품 번호(예: 24CN...)는 이 API에 없음
    nos = sorted({str(r[ci]).strip() for r in web["rows"] if r[ci] and re.fullmatch(r"\d{8,16}", str(r[ci]).strip())})
    # 우선순위: API가 시간당 100건만 허용하므로 페르소나가 많이 볼 제품부터
    #  1팩 제품 > 단백질 10g↑ > 대기업 아님 > 최근 등록
    prio = {}
    for r in web["rows"]:
        no = str(r[ci] or "").strip()
        if no not in prio and re.fullmatch(r"\d{8,16}", no):
            size = r[ix["size"]] or 0
            p = (r[ix["protein"]] or 0) * size / 100 if r[ix["single"]] else 0
            major = "major" in ix and r[ix["major"]] is not None and r[ix["major"]] >= 0
            prio[no] = ((1 if r[ix["single"]] else 0) * 4 + (2 if p >= 10 else 0) + (0 if major else 1), r[ix["created"]] or "")
    cache = load_cache()
    todo = [n for n in nos if n not in cache or "error" in cache[n]]
    todo.sort(key=lambda n: prio.get(n, (0, "")), reverse=True)
    todo = todo[: a.limit]
    print(f"품목보고번호 {len(nos)}개 중 수집 대상 {len(todo)}개 (키: {'개인키' if key != 'sample' else 'sample'})")
    done = 0
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(fetch, key, n): n for n in todo}
        limited = 0
        for fut in cf.as_completed(futs):
            r = fut.result()
            cache[futs[fut]] = r
            done += 1
            if r.get("limit"):
                limited += 1
                if limited >= 20:  # 한도 초과가 이어지면 이번 실행 중단 (남은 건 다음 실행)
                    print(f"API 거부({r.get('error')}: {r.get('msg')}) — {done}건 처리 후 중단. 남은 건 다음 실행")
                    for f in futs:
                        f.cancel()
                    break
            if a.max_minutes and time.time() - t0 > a.max_minutes * 60:
                print(f"시간 제한 {a.max_minutes}분 — {done}건 처리 후 저장하고 멈춤 (남은 건 다음 실행)")
                for f in futs:
                    f.cancel()
                break
            if done % 500 == 0:
                save_cache(cache)
                print(f"  {done}/{len(todo)}")
    save_cache(cache)
    have = sum(1 for n in nos if cache.get(n, {}).get("raw"))
    err = sum(1 for n in nos if "error" in cache.get(n, {}))
    print(f"완료: 원재료 확보 {have}/{len(nos)} ({have/max(len(nos),1):.0%}), 오류 {err}")


if __name__ == "__main__":
    main()
