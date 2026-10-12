"use client";
// FR-4 스펙 비교 (같은 행 정렬, 등급·순위·강조색 없음) · FR-10 URL 공유
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Basis, Dataset, Drink, basisLabel, effectiveBasis, fmtNum, loadData, nut, Nutrients } from "@/lib/data";
import { MAX_COMPARE, useCompare } from "@/lib/compare";
import { Footer, Header, toast } from "./ui";
import Pack from "./Pack";

type Row = { key: keyof Nutrients | "caffeine"; label: string; unit: string; main?: boolean };
const ROWS: Row[] = [
  { key: "protein", label: "단백질", unit: "g", main: true },
  { key: "sugar", label: "당류", unit: "g", main: true },
  { key: "caffeine", label: "카페인", unit: "mg", main: true },
  { key: "kcal", label: "열량", unit: "kcal" },
  { key: "carb", label: "탄수화물", unit: "g" },
  { key: "fat", label: "지방", unit: "g" },
  { key: "satFat", label: "포화지방", unit: "g" },
  { key: "sodium", label: "나트륨", unit: "mg" },
];

export default function CompareView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const store = useCompare();
  const [data, setData] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [basis, setBasis] = useState<Basis>("pack");

  useEffect(() => {
    loadData().then(setData).catch((e) => setErr(String(e.message || e)));
  }, []);

  const urlIds = (sp.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPARE);
  const ids = urlIds.length ? urlIds : store.ids;
  const items = useMemo(() => (data ? ids.map((i) => data.byId.get(i)).filter((x): x is Drink => !!x) : []), [data, ids]);
  const missing = data ? ids.filter((i) => !data.byId.has(i)) : [];

  // 공유 링크로 들어오면 비교함을 그 목록으로 맞춘다
  useEffect(() => {
    if (urlIds.length && urlIds.join() !== store.ids.join()) store.set(urlIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const remove = (id: string) => {
    const next = ids.filter((x) => x !== id);
    store.set(next);
    router.replace(next.length ? `${pathname}?ids=${next.map(encodeURIComponent).join(",")}` : pathname, { scroll: false });
  };

  const share = async () => {
    const url = `${window.location.origin}${pathname}?ids=${ids.map(encodeURIComponent).join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("링크를 복사했어요");
    } catch {
      window.prompt("이 링크를 복사하세요", url);
    }
  };

  const anyPack = items.some((d) => d.single);

  return (
    <>
      <Header active="compare" />
      <main className="wrap">
        <div className="ctitle">
          <h1>나란히 놓고 본다.</h1>
          <p>{items.length}개 제품 · 표시값 그대로 · 순위·점수 없음</p>
        </div>
        {err ? (
          <div className="empty"><h3>데이터를 불러오지 못했어요</h3><p>{err}</p></div>
        ) : !data ? (
          <div className="skel" style={{ height: 360 }} />
        ) : items.length === 0 ? (
          <div className="empty">
            <h3>비교함이 비어 있어요</h3>
            <p>목록에서 제품 카드 오른쪽 위 체크 버튼을 눌러 최대 {MAX_COMPARE}개까지 담아 보세요.</p>
            {missing.length ? <p>링크에 있던 제품 {missing.length}개는 DB에 없어서 보여줄 수 없어요.</p> : null}
            <p><Link href="/" className="btn-acc" style={{ display: "inline-block", marginTop: 6 }}>음료 찾으러 가기</Link></p>
          </div>
        ) : (
          <>
            <div className="seg" role="group" aria-label="표시 기준" style={{ marginBottom: 14, maxWidth: 360 }}>
              <button type="button" className={basis === "pack" ? "on" : ""} disabled={!anyPack} onClick={() => setBasis("pack")}>1팩 기준</button>
              <button type="button" className={basis === "100" ? "on" : ""} onClick={() => setBasis("100")}>100ml(g) 기준</button>
            </div>
            <div className="cscroll">
              <table className="ctable">
                <thead>
                  <tr>
                    <th className="lab" scope="col"><span className="sr">항목</span></th>
                    {items.map((d) => (
                      <th key={d.id} scope="col">
                        <div className="pcol">
                          <button type="button" className="rm" aria-label={`${d.name} 비교에서 빼기`} onClick={() => remove(d.id)}>×</button>
                          <Link href={`/p/?id=${encodeURIComponent(d.id)}`} style={{ display: "grid", gap: 4 }}>
                            <Pack d={d} className="thumb" />
                            <span className="brand mono">{d.maker || "–"}</span>
                            <span className="pn">{d.name}</span>
                          </Link>
                          <span className="basis">{basisLabel(d, effectiveBasis(d, basis))}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.key} className={r.main ? "key" : ""}>
                      <th className="lab" scope="row"><b>{r.label}</b><i>{r.unit}</i></th>
                      {items.map((d) => {
                        const v = r.key === "caffeine" ? d.caffeine : nut(d, r.key, effectiveBasis(d, basis));
                        return <td key={d.id}>{v === null ? <span className="na">정보 없음</span> : fmtNum(v)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="notebox" style={{ marginTop: 16 }}>
              순위·점수 없이 제품 표시값만 나란히 보여줍니다. 대용량(500ml 초과)은 100ml(g) 기준으로 표시돼 다른 제품과 기준이 다를 수 있어요. 출처: 식품의약품안전처 식품영양성분DB.
            </div>
            <div className="cactions">
              <Link href="/" className="btn-line">+ 제품 추가</Link>
              <button type="button" className="btn-ink" onClick={share}>링크 복사</button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
