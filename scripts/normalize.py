"""원천(data/raw/<날짜>.json.gz) → 정제 데이터.

출력
- data/processed/drinks.json.gz   전체 정제본 (음료류 전체, 사람이 검수할 때 사용)
- data/processed/summary.json     건수·커버리지 (웹 업데이트 바, 분석방법 페이지가 읽음)
- data/processed/ids/<날짜>.txt    수집일별 식품코드 목록 (다음 수집 때 '신규' 판정용)
- web/public/data/drinks.min.json 웹이 읽는 경량본 (바로 마시는 음료만)

규칙 (docs/CRITERIA.md 와 함께 바뀐다. 바꾸면 CHANGELOG 에 기록)
- R1 범위: 대분류 음료류 중 '바로 마시는 음료'(RTD_TYPES)만 웹에 노출. 원두·분말·농축/베이스·고형차·침출차·인스턴트커피는 희석해서 먹으므로 제외.
- R2 기준량: 포장 1개 용량이 500ml(g) 이하이고 기준단위(ml/g)가 원천 기준량과 같으면 '1팩 기준', 아니면 '100ml(g) 기준'.
- R3 빈 값은 null. 추정해서 채우지 않는다 (NFR-3).
- R4 카페인: 원천에 없음 → data/samples/caffeine_labels.csv(제품 표시사항, 약사 확인)에서만.
- R5 신규: 직전 수집일(ids/<이전날짜>.txt)에 없던 식품코드. 직전 수집이 없으면 원천에서 가장 최근 데이터생성일자로부터 30일 이내에 등록된 제품.
실행: python3 scripts/normalize.py [YYYY-MM-DD]  (생략 시 가장 최근 raw)
"""
import csv
import datetime
import gzip
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
WEB = ROOT / "web" / "public" / "data"

RTD_TYPES = ["액상음료", "과·채주스", "액상차", "과·채음료", "액상커피", "탄산음료", "인삼/홍삼음료",
             "두유", "발효음료", "유산균음료", "탄산수", "효모음료"]
PACK_LIMIT = 500
NEW_DAYS = 30
NUTS = [  # (원천 필드, 키)
    ("enerc", "kcal"), ("prot", "protein_g"), ("sugar", "sugar_g"), ("chocdf", "carb_g"),
    ("fatce", "fat_g"), ("fasat", "sat_fat_g"), ("fatrn", "trans_fat_g"),
    ("chole", "cholesterol_mg"), ("nat", "sodium_mg"), ("fibtg", "fiber_g"), ("k", "potassium_mg"),
]

# R6. 원재료명(식품안전나라 C002) → 사실 태그. 효능·인증을 뜻하지 않고 "원재료명에 ~가 있다/없다"만 말한다.
# (태그 id, 화면 이름, 포함 키워드 정규식)
INGREDIENT_TAGS = [
    ("dairy", "유제품 원료", r"우유|원유|유청|유단백|분유|유당|크림|버터|치즈|카제인|연유|발효유|우유단백|밀크"),
    ("probiotic", "유산균 원료", r"유산균|락토바실|비피|프로바이오|스트렙토코|L\. |락토코커스|사균|열처리배양"),
    ("plantprotein", "식물성 단백 원료", r"대두단백|분리대두|완두단백|쌀단백|현미단백|귀리|오트|아몬드|두유액|대두|병아리콩|햄프"),
    ("animalprotein", "동물성 단백 원료", r"유청단백|우유단백|분리유청|농축유청|카제인|콜라겐|계란|난백|젤라틴"),
    ("collagen", "콜라겐 원료", r"콜라겐"),
    ("caffeine_src", "카페인 원료", r"카페인|커피|원두|녹차|홍차|말차|과라나|마테|보이차|우롱|에스프레소|콜라넛"),
    ("fiber_src", "식이섬유 원료", r"난소화성말토덱스트린|난소화성 말토덱스트린|이눌린|치커리|폴리덱스트로스|차전자피|구아검분해물|식이섬유|저항성"),
    ("amino", "아미노산 원료", r"류신|발린|아르기닌|글루타민|타우린|BCAA|시트룰린|오르니틴|베타알라닌"),
    ("electrolyte", "전해질 원료", r"염화칼륨|염화마그네슘|젖산칼슘|구연산칼륨|인산이수소칼륨|해양심층수|미네랄|염화칼슘"),
    ("carbonated", "탄산", r"탄산가스|이산화탄소|탄산수"),
]
SWEETENERS = [  # (id, 화면 이름, 정규식) — 원재료명 기준
    ("sugar", "설탕·당류 원료", r"설탕|원당|액상과당|과당|포도당|물엿|올리고당|꿀|벌꿀|맥아당|시럽|당밀|조청"),
    ("allulose", "알룰로스", r"알룰로스|알룰로오스|사이코스"),
    ("erythritol", "에리스리톨", r"에리스리톨"),
    ("sucralose", "수크랄로스", r"수크랄로스"),
    ("acek", "아세설팜칼륨", r"아세설팜"),
    ("stevia", "스테비아", r"스테비|레바우디오"),
    ("aspartame", "아스파탐", r"아스파탐"),
    ("sugaralcohol", "말티톨·자일리톨", r"말티톨|자일리톨|소르비톨"),
    ("monkfruit", "나한과", r"나한과"),
]
NAME_TAGS = [("lactofree", "락토프리 표기", r"락토프리|lactose.?free|유당.?0|유당제로")]


def num(v):
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s in ("", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def clean(v):
    v = (v or "").strip()
    return None if v in ("", "해당없음") else v


def pack_size(food_size):
    m = re.match(r"^\s*([\d.]+)\s*(ml|mL|ML|g|G)?\s*$", food_size or "")
    if not m:
        return None, None
    return float(m.group(1)), (m.group(2) or "g").lower()


def basis_unit(basis):
    b = (basis or "").lower()
    return "ml" if "ml" in b else ("g" if "g" in b else None)


def guess_shape(name, typ, size):
    """이미지가 없을 때 보여줄 포장 실루엣 종류 (장식용, 실제 포장과 다를 수 있음)."""
    n = name or ""
    if "캔" in n:
        return "can"
    if "파우치" in n or "스틱" in n:
        return "pouch"
    if "팩" in n or typ == "두유":
        return "carton"
    if typ in ("탄산음료", "탄산수", "액상커피") and size and size <= 355:
        return "can"
    if typ == "인삼/홍삼음료" and size and size <= 100:
        return "pouch"
    return "pet"


def load_caffeine():
    p = ROOT / "data" / "samples" / "caffeine_labels.csv"
    if not p.exists():
        return {}
    with p.open(encoding="utf-8") as f:
        return {r["food_cd"].strip(): r for r in csv.DictReader(f) if (r.get("food_cd") or "").strip()}


def load_ingredients():
    p = ROOT / "data" / "ingredients" / "cache.json.gz"
    if not p.exists():
        return {}
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


def load_taste():
    """data/samples/taste_notes.csv — 팀 시음 패널 기록 (기준 음료 대비 + 5축 약/중/강)."""
    p = ROOT / "data" / "samples" / "taste_notes.csv"
    if not p.exists():
        return {}
    out = {}
    with p.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            cd = (r.get("food_cd") or "").strip()
            if not cd:
                continue
            lv = {"약": 1, "중": 2, "강": 3}
            out[cd] = [
                (r.get("anchor") or "").strip(),
                [lv.get((r.get(k) or "").strip(), 0) for k in ("sweet", "sour", "fizz", "body", "after")],
                int(r.get("panel_n") or 0),
                (r.get("tasted_at") or "").strip(),
                (r.get("note") or "").strip()[:120],
            ]
    return out


def tag_ingredients(raw_text, name):
    """원재료명 → (태그 비트, 감미료 비트). 원재료명이 없으면 이름 태그만."""
    import re as _re
    tags, sw = 0, 0
    n = name or ""
    for i, (_, _, pat) in enumerate(NAME_TAGS):
        if _re.search(pat, n, _re.I):
            tags |= 1 << (len(INGREDIENT_TAGS) + i)
    if not raw_text:
        return tags, sw
    for i, (_, _, pat) in enumerate(INGREDIENT_TAGS):
        if _re.search(pat, raw_text, _re.I):
            tags |= 1 << i
    for i, (_, _, pat) in enumerate(SWEETENERS):
        if _re.search(pat, raw_text, _re.I):
            sw |= 1 << i
    return tags, sw


def load_major():
    """data/brands/major.csv — 대기업·음료 상위사 판별 규칙 (CRITERIA R9).
    식약처 DB의 제조사는 실제 생산 공장(OEM)이라 브랜드와 다를 수 있어, 제조사명 + 제품명 키워드를 함께 본다."""
    import re as _re
    p = ROOT / "data" / "brands" / "major.csv"
    if not p.exists():
        return []
    with p.open(encoding="utf-8") as f:
        return [(r["kind"], _re.compile(r["pattern"]), r["group"]) for r in csv.DictReader(f) if r.get("pattern")]


def major_group(rules, maker, name):
    for kind, rx, group in rules:
        if rx.search((maker if kind == "maker" else name) or ""):
            return group
    return None


def load_images():
    p = ROOT / "data" / "images" / "manifest.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def main() -> None:
    files = sorted(RAW.glob("*.json.gz"))
    if not files:
        sys.exit("data/raw 에 원천 파일이 없습니다.")
    src = RAW / f"{sys.argv[1]}.json.gz" if len(sys.argv) > 1 else files[-1]
    day = src.name.split(".")[0]
    with gzip.open(src, "rt", encoding="utf-8") as f:
        raw = json.load(f)

    ids_dir = PROC / "ids"
    ids_dir.mkdir(parents=True, exist_ok=True)
    prev_files = sorted(p for p in ids_dir.glob("*.txt") if p.stem < day)
    prev_ids = set(prev_files[-1].read_text().split()) if prev_files else None
    created_all = [x.get("crtYmd") for x in raw["items"] if x.get("crtYmd")]
    latest_created = datetime.date.fromisoformat(max(created_all)) if created_all else datetime.date.fromisoformat(day)
    caffeine, images = load_caffeine(), load_images()
    ingr, taste = load_ingredients(), load_taste()
    major_rules = load_major()

    items, seen = [], set()
    for it in raw["items"]:
        cd = it.get("foodCd")
        if not cd or cd in seen:
            continue
        seen.add(cd)
        typ = it.get("foodLv4Nm")
        size, unit = pack_size(it.get("foodSize"))
        bunit = basis_unit(it.get("nutConSrtrQua"))
        per100 = {k: num(it.get(s)) for s, k in NUTS}
        single = size is not None and size <= PACK_LIMIT and unit == bunit
        created = it.get("crtYmd") or None
        if prev_ids is not None:
            is_new = cd not in prev_ids
        else:
            try:
                is_new = (latest_created - datetime.date.fromisoformat(created)).days <= NEW_DAYS
            except (TypeError, ValueError):
                is_new = False
        cf = caffeine.get(cd)
        rno = clean(it.get("itemMnftrRptNo"))
        ing = (ingr.get(str(rno).strip()) or {}) if rno else {}
        tags, sweet = tag_ingredients(ing.get("raw"), it.get("foodNm"))
        items.append({
            "id": cd,
            "name": (it.get("foodNm") or "").strip(),
            "maker": clean(it.get("mfrNm")),
            "importer": clean(it.get("imptNm")),
            "type": typ,
            "rtd": typ in RTD_TYPES,
            "basis_unit": bunit,
            "pack": {"size": size, "unit": unit},
            "single_serve": single,
            "per100": per100,
            "per_pack": {k: (None if v is None else round(v * size / 100, 1)) for k, v in per100.items()} if single else None,
            "caffeine_mg": num(cf["caffeine_mg"]) if cf else None,
            "caffeine_source": "label" if cf else None,
            "report_no": clean(it.get("itemMnftrRptNo")),
            "source": it.get("srcNm"),
            "data_created": created,
            "data_base_date": it.get("crtrYmd"),
            "collected": day,
            "is_new": is_new,
            "image": images.get(cd),
            "shape": guess_shape(it.get("foodNm"), typ, size),
            "ingredients": ing.get("raw"),
            "ingredients_checked": ing.get("checked"),
            "tags": tags,
            "sweet": sweet,
            "taste": taste.get(cd),
            "major": major_group(major_rules, clean(it.get("mfrNm")), it.get("foodNm")),
        })

    PROC.mkdir(parents=True, exist_ok=True)
    # mtime=0: 내용이 같으면 파일도 같게 (불필요한 커밋 방지)
    with open(PROC / "drinks.json.gz", "wb") as raw_f, gzip.GzipFile(fileobj=raw_f, mode="wb", mtime=0) as gz:
        gz.write(json.dumps({"collected": day, "count": len(items), "items": items}, ensure_ascii=False).encode("utf-8"))
    (ids_dir / f"{day}.txt").write_text("\n".join(sorted(seen)))

    # ---- 웹 경량본 (컬럼 배열) ----
    web = [d for d in items if d["rtd"]]
    makers = sorted({d["maker"] or d["importer"] or "" for d in web})
    types = RTD_TYPES
    shapes = ["pet", "can", "carton", "pouch"]
    mi = {m: i for i, m in enumerate(makers)}
    cols = ["id", "name", "maker", "type", "size", "unit", "basisUnit", "single",
            "kcal", "protein", "sugar", "carb", "fat", "satFat", "transFat", "chol", "sodium",
            "caffeine", "created", "isNew", "image", "shape", "importer", "reportNo",
            "fiber", "potassium", "tags", "sweet", "hasIngr", "taste", "major"]
    major_groups = sorted({d["major"] for d in web if d["major"]})
    rows = []
    for d in web:
        p = d["per100"]
        rows.append([
            d["id"], d["name"], mi[d["maker"] or d["importer"] or ""], types.index(d["type"]),
            d["pack"]["size"], d["pack"]["unit"], d["basis_unit"], 1 if d["single_serve"] else 0,
            p["kcal"], p["protein_g"], p["sugar_g"], p["carb_g"], p["fat_g"], p["sat_fat_g"],
            p["trans_fat_g"], p["cholesterol_mg"], p["sodium_mg"],
            d["caffeine_mg"], d["data_created"], 1 if d["is_new"] else 0, d["image"],
            shapes.index(d["shape"]), 1 if d["importer"] else 0, d["report_no"],
            p["fiber_g"], p["potassium_mg"], d["tags"], d["sweet"], 1 if d["ingredients"] else 0, d["taste"],
            major_groups.index(d["major"]) if d["major"] else -1,
        ])
    # 원재료명 전문은 상세 화면에서만 필요 → 해시 샤드로 분리 (목록 로딩 가볍게)
    import hashlib
    shards = {}
    for d in web:
        if d["ingredients"]:
            h = hashlib.md5(d["id"].encode()).hexdigest()[:2]
            shards.setdefault(h, {})[d["id"]] = [d["ingredients"], d["ingredients_checked"]]
    sd = WEB / "ingr"
    sd.mkdir(parents=True, exist_ok=True)
    for f in sd.glob("*.json"):
        f.unlink()
    for h, m in shards.items():
        (sd / f"{h}.json").write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    base_dates = sorted({d["data_base_date"] for d in web if d["data_base_date"]})
    summary = {
        "collected": day,
        "baseDate": base_dates[-1] if base_dates else None,
        "rawTotal": len(items),
        "count": len(web),
        "excluded": len(items) - len(web),
        "singleServe": sum(1 for d in web if d["single_serve"]),
        "newCount": sum(1 for d in web if d["is_new"]),
        "newRule": "prev" if prev_ids is not None else "created30",
        "latestCreated": latest_created.isoformat(),
        "caffeineCount": sum(1 for d in web if d["caffeine_mg"] is not None),
        "imageCount": sum(1 for d in web if d["image"]),
        "byType": {t: sum(1 for d in web if d["type"] == t) for t in types},
        "ingredientCount": sum(1 for d in web if d["ingredients"]),
        "tasteCount": sum(1 for d in web if d["taste"]),
        "fiberCount": sum(1 for d in web if d["per100"]["fiber_g"] is not None),
        "majorCount": sum(1 for d in web if d["major"]),
    }
    WEB.mkdir(parents=True, exist_ok=True)
    (WEB / "drinks.min.json").write_text(json.dumps(
        {"v": 3, "summary": summary, "cols": cols, "makers": makers, "types": types, "shapes": shapes,
         "tagDefs": [[t, n] for t, n, _ in INGREDIENT_TAGS] + [[t, n] for t, n, _ in NAME_TAGS],
         "sweetDefs": [[t, n] for t, n, _ in SWEETENERS], "majorGroups": major_groups, "rows": rows},
        ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (PROC / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"원천 {len(items)}개 → 웹 노출(바로 마시는 음료) {len(web)}개, 제외 {len(items)-len(web)}개")
    print(f"  1팩 기준 표시 {summary['singleServe']}개 ({summary['singleServe']/max(len(web),1):.0%}), 나머지 100ml(g) 기준")
    print(f"  신규 {summary['newCount']}개 (규칙: {summary['newRule']})")
    print(f"  카페인 {summary['caffeineCount']}개, 이미지 {summary['imageCount']}개, 원재료 {summary['ingredientCount']}개, 맛 기록 {summary['tasteCount']}개, 식이섬유 값 {summary['fiberCount']}개, 대기업 브랜드 {summary['majorCount']}개")
    print(f"  웹 데이터 {(WEB / 'drinks.min.json').stat().st_size/1e6:.1f}MB")


if __name__ == "__main__":
    main()
