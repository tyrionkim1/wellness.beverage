"""제품 이미지 누끼 파이프라인 (10/12 결정: B안 — 제조사 공개 이미지 + 배경 제거).

입력  data/images/sources.csv   컬럼: food_cd, source_url, collected_at, note
처리  1) source_url 이미지를 data/images/source/<food_cd>.<ext> 로 저장 (이미 있으면 건너뜀)
      2) rembg 로 배경 제거 → 여백 정리 → 최대 600px WebP
출력  web/public/img/<food_cd>.webp,  data/images/manifest.json {food_cd: 파일명}

- 출처 URL 은 sources.csv 에 남겨 요청 시 즉시 교체·삭제할 수 있게 한다 (docs/CRITERIA.md).
- sources.csv 에서 행을 지우면 다음 실행 때 manifest 에서도 빠진다.
- 실행: pip install "rembg[cpu]" pillow && python3 scripts/images.py
"""
import csv
import io
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC_CSV = ROOT / "data" / "images" / "sources.csv"
SRC_DIR = ROOT / "data" / "images" / "source"
OUT_DIR = ROOT / "web" / "public" / "img"
MANIFEST = ROOT / "data" / "images" / "manifest.json"
MAX_PX = 600
UA = "Mozilla/5.0 (cheongdam-drink image pipeline; KAIST class project)"


def download(url: str, dest_stem: pathlib.Path) -> pathlib.Path:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
        ctype = r.headers.get("Content-Type", "")
    ext = ".png" if "png" in ctype else ".webp" if "webp" in ctype else ".jpg"
    path = dest_stem.with_suffix(ext)
    path.write_bytes(data)
    return path


def main() -> None:
    try:
        from PIL import Image
        from rembg import new_session, remove
    except ImportError:
        sys.exit('필요 패키지: pip install "rembg[cpu]" pillow')

    if not SRC_CSV.exists():
        print("sources.csv 없음 — 처리할 이미지가 없습니다.")
        return
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [r for r in csv.DictReader(SRC_CSV.open(encoding="utf-8")) if (r.get("food_cd") or "").strip() and (r.get("source_url") or "").strip()]
    session = new_session("u2net")
    manifest, ok, fail = {}, 0, []
    for r in rows:
        cd = r["food_cd"].strip()
        out = OUT_DIR / f"{cd}.webp"
        try:
            existing = sorted(SRC_DIR.glob(f"{cd}.*"))
            src = existing[0] if existing else download(r["source_url"].strip(), SRC_DIR / cd)
            if not out.exists() or out.stat().st_mtime < src.stat().st_mtime:
                img = Image.open(src).convert("RGBA")
                cut = remove(img, session=session)
                bbox = cut.getbbox()
                if bbox:
                    cut = cut.crop(bbox)
                cut.thumbnail((MAX_PX, MAX_PX))
                buf = io.BytesIO()
                cut.save(buf, "WEBP", quality=88)
                out.write_bytes(buf.getvalue())
            manifest[cd] = out.name
            ok += 1
        except Exception as e:  # 한 장 실패해도 나머지는 진행
            fail.append(f"{cd}: {e}")
    # sources.csv 에서 빠진 이미지는 웹에서도 내린다
    for f in OUT_DIR.glob("*.webp"):
        if f.stem not in manifest:
            f.unlink()
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    print(f"이미지 {ok}개 처리, 실패 {len(fail)}개")
    for x in fail:
        print("  실패", x)


if __name__ == "__main__":
    main()
