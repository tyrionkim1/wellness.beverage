"""data/raw/<날짜>/ 원천 → data/processed/drinks.json (웹이 읽는 파일).

규칙 (docs/SCHEMA.md, docs/CRITERIA.md 와 함께 바뀐다):
- 원천 수치는 100g(ml) 기준. 1팩 기준 = 100g 수치 × 식품중량 / 100.
- 식품중량이 없거나 숫자로 못 읽으면 per_pack = null (추정해서 채우지 않음, NFR-3).
- 빈 값은 null. 0과 '정보 없음'을 구분한다.
- 카페인은 원천에 없음 → data/samples/caffeine_labels.csv(제품 표시사항, 약사 확인)에서만 채운다.
- 실행: python3 scripts/normalize.py [YYYY-MM-DD]  (생략 시 가장 최근 raw)
"""
import csv
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIELDS = {  # 원천 필드 → 우리 키
    "enerc": "kcal", "prot": "protein_g", "sugar": "sugar_g", "chocdf": "carb_g",
    "fatce": "fat_g", "fasat": "sat_fat_g", "fatrn": "trans_fat_g",
    "chole": "cholesterol_mg", "nat": "sodium_mg",
}


def num(v):
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s == "" or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def pack_size(food_size: str):
    """'330ml', '330g', '330' → (330.0, 'ml'|'g'). 못 읽으면 (None, None)."""
    m = re.match(r"^\s*([\d.]+)\s*(ml|mL|g|ML)?\s*$", food_size or "")
    if not m:
        return None, None
    return float(m.group(1)), (m.group(2) or "g").lower()


def load_caffeine():
    p = ROOT / "data" / "samples" / "caffeine_labels.csv"
    if not p.exists():
        return {}
    with p.open(encoding="utf-8") as f:
        return {r["food_cd"]: r for r in csv.DictReader(f)}


def main() -> None:
    raw_root = ROOT / "data" / "raw"
    day = sys.argv[1] if len(sys.argv) > 1 else sorted(p.name for p in raw_root.iterdir() if p.is_dir())[-1]
    caffeine = load_caffeine()
    out, seen = [], set()
    for page in sorted((raw_root / day).glob("page_*.json")):
        body = json.loads(page.read_text(encoding="utf-8"))
        for it in body["response"]["body"].get("items") or []:
            cd = it.get("foodCd")
            if not cd or cd in seen:
                continue
            seen.add(cd)
            size, unit = pack_size(it.get("foodSize", ""))
            per100 = {k: num(it.get(src)) for src, k in FIELDS.items()}
            per_pack = None if size is None else {
                k: (None if v is None else round(v * size / 100, 1)) for k, v in per100.items()
            }
            cf = caffeine.get(cd)
            out.append({
                "id": cd,
                "name": it.get("foodNm"),
                "maker": it.get("mfrNm") if it.get("mfrNm") not in (None, "", "해당없음") else None,
                "importer": it.get("imptNm") if it.get("imptNm") not in (None, "", "해당없음") else None,
                "category": [it.get("foodLv4Nm"), it.get("foodLv6Nm")],
                "basis": it.get("nutConSrtrQua"),
                "pack": {"size": size, "unit": unit},
                "per100": per100,
                "per_pack": per_pack,
                "caffeine_mg": num(cf["caffeine_mg"]) if cf else None,
                "caffeine_source": "label" if cf else None,
                "report_no": it.get("itemMnftrRptNo"),
                "source": it.get("srcNm"),
                "data_created": it.get("crtYmd"),
                "data_base_date": it.get("crtrYmd"),
                "collected": day,
            })
    dest = ROOT / "data" / "processed" / "drinks.json"
    dest.write_text(json.dumps({"collected": day, "count": len(out), "items": out}, ensure_ascii=False), encoding="utf-8")

    def cov(key):
        return sum(1 for d in out if d["per_pack"] and d["per_pack"][key] is not None)
    print(f"음료 {len(out)}개")
    print(f"1팩 환산 가능 {sum(1 for d in out if d['per_pack'])}개")
    for k in ("protein_g", "sugar_g"):
        print(f"  {k} 커버리지 {cov(k)}/{len(out)} ({cov(k)/max(len(out),1):.0%})")
    print(f"  caffeine 커버리지 {sum(1 for d in out if d['caffeine_mg'] is not None)}/{len(out)}")


if __name__ == "__main__":
    main()
