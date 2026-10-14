"use client";
// 청담음료 제품 상세 — 기획 시안(라이트 베이지) 톤. 표시값만 보여주고 평가·효능 표현은 하지 않는다.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Pack from "@/components/Pack";
import {
  Basis, Dataset, Drink, NUT_KEYS, NUT_LABEL, dvPercent, effectiveBasis, fmtDate, fmtNum, fmtSize,
  loadData, loadIngredients, nut, sweetNames, tagNames,
} from "@/lib/data";
import { ga, useGA } from "../ga";

export default function ChungdamDetail() {
  const id = useSearchParams().get("id") || "";
  useGA();
  const [ds, setDs] = useState<Dataset | null>(null);
  const [basis, setBasis] = useState<Basis>("pack");
  const [ingr, setIngr] = useState<[string, string] | null | undefined>(undefined);

  useEffect(() => { loadData().then(setDs).catch(() => setDs(null)); }, []);
  const d: Drink | undefined = ds?.byId.get(id);

  useEffect(() => {
    if (!d) return;
    ga("product_detail_view", { id: d.id, name: d.name });
    if (d.hasIngr) loadIngredients(d.id).then(setIngr); else setIngr(null);
  }, [d]);

  if (!ds) return <Shell><div className="cd-empty">불러오는 중…</div></Shell>;
  if (!d) return <Shell><div className="cd-empty">제품을 찾을 수 없어요. <Link href="/chungdam/">처음으로</Link></div></Shell>;

  const b = effectiveBasis(d, basis);
  const facts = [...tagNames(d, ds.tagDefs).filter((n) => n !== "탄산"), ...sweetNames(d, ds.sweetDefs)];

  return (
    <Shell>
      <button type="button" className="cd-back" onClick={() => (history.length > 1 ? history.back() : (location.href = "./"))}>← 목록으로</button>

      <div className="cd-dhead">
        <Pack d={d} className="cd-pack big" />
        <div className="cd-info">
          <small>{d.maker || "제조사 정보 없음"}</small>
          <h1 className="cd-dname">{d.name}</h1>
          <em>{fmtSize(d)} · {d.type}{d.imported ? " · 수입" : ""}</em>
          {facts.length ? <span className="cd-tags">{facts.map((t) => <span key={t}>{t}</span>)}</span> : null}
        </div>
      </div>

      <section className="cd-dcard">
        <div className="cd-res-head">
          <h2 className="cd-h2">영양성분</h2>
          {d.single ? (
            <div className="cd-sort" role="tablist" aria-label="표시 기준">
              <button type="button" role="tab" aria-selected={b === "pack"} className={b === "pack" ? "on" : ""} onClick={() => setBasis("pack")}>1팩 기준</button>
              <button type="button" role="tab" aria-selected={b === "100"} className={b === "100" ? "on" : ""} onClick={() => setBasis("100")}>100{d.basisUnit || "ml"} 기준</button>
            </div>
          ) : <span className="cd-res-meta">100{d.basisUnit || "ml"} 기준</span>}
        </div>
        <table className="cd-nut">
          <tbody>
            {NUT_KEYS.map((k) => {
              const v = nut(d, k, b);
              const L = NUT_LABEL[k];
              const pct = dvPercent(k, v);
              return (
                <tr key={k} className={L.sub ? "sub" : ""}>
                  <th>{L.label}</th>
                  <td>{v === null ? <span className="na">정보 없음</span> : <>{fmtNum(v)}<i>{L.unit}</i></>}</td>
                  <td className="pct">{pct !== null ? `${pct}%` : ""}</td>
                </tr>
              );
            })}
            <tr>
              <th>카페인</th>
              <td>{d.caffeine === null ? <span className="na">정보 없음</span> : <>{fmtNum(d.caffeine)}<i>mg</i></>}</td>
              <td className="pct">{d.caffeine !== null ? "1팩" : ""}</td>
            </tr>
          </tbody>
        </table>
        <p className="cd-note">%는 1일 영양성분 기준치 대비 비율입니다. 값이 없는 항목은 0으로 채우지 않고 &lsquo;정보 없음&rsquo;으로 표시합니다.</p>
      </section>

      <section className="cd-dcard">
        <h2 className="cd-h2">원재료</h2>
        {ingr === undefined ? <p className="cd-sub">불러오는 중…</p>
          : ingr ? (
            <>
              <p className="cd-ingr">{ingr[0]}</p>
              <p className="cd-note">출처: 식품안전나라 품목제조보고(원재료) · 확인일 {fmtDate(ingr[1])}. 태그는 원재료명 표기 여부만 뜻하며 효능·인증을 의미하지 않습니다.</p>
            </>
          ) : <p className="cd-sub">아직 원재료 정보를 확보하지 못한 제품이에요.</p>}
      </section>

      <Link href="/chungdam/#signup" className="cd-btn block" onClick={() => ga("signup_start", { from: "detail" })}>출시 알림 받기</Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cd">
      <header className="cd-hdr">
        <div className="cd-wrap cd-hdr-in">
          <Link href="/chungdam/" className="cd-logo">청담음료</Link>
          <nav className="cd-nav"><Link href="/chungdam/#finder">음료 찾기</Link></nav>
        </div>
      </header>
      <main className="cd-wrap cd-detail">{children}</main>
      <footer className="cd-ftr">
        <div className="cd-wrap">
          <p>데이터 출처: 식품의약품안전처 식품영양성분DB(공공데이터포털). 표시값은 제품 영양성분표 기준이며 질병의 예방·치료 효과를 의미하지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
}
