"use client";
// 청담음료 제품 상세 (요구사항 4.1 PD-01~08). 표시값만 보여주고 평가·효능 표현은 하지 않는다.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Pack from "@/components/Pack";
import {
  Basis, Dataset, Drink, NUT_KEYS, NUT_LABEL, dvPercent, effectiveBasis, fmtDate, fmtNum, fmtSize,
  insights, loadData, loadIngredients, nut, sweetNames,
} from "@/lib/data";
import { GLOSSARY } from "@/lib/glossary";
import { ga, useGA } from "../ga";
import { Shell, Stat, evidenceTags, Picto, samplersWith, won } from "../shared";

// 원재료명 표기에서 찾는 알레르기 유발 원료(참고용). 포장 표시가 우선.
const ALLERGENS: [string, RegExp][] = [
  ["우유", /우유|유청|분유|유단백|카제인|크림|버터|치즈|연유|원유|유당|락토/],
  ["대두", /대두|두유|콩/],
  ["밀", /밀(?!크)|소맥/],
  ["알류", /난백|난황|계란|달걀|전란/],
  ["땅콩", /땅콩/], ["호두", /호두/], ["잣", /잣/], ["복숭아", /복숭아/], ["토마토", /토마토/],
  ["아황산류", /아황산|메타중아황산|무수아황산/],
];

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
    ga("product_detail_view", { product_id: d.id });
    if (d.hasIngr) loadIngredients(d.id).then(setIngr); else setIngr(null);
  }, [d]);

  const allergens = useMemo(() => (ingr ? ALLERGENS.filter(([, re]) => re.test(ingr[0])).map(([n]) => n) : []), [ingr]);

  if (!ds) return <Shell><main className="cd-wrap cd-page"><div className="cd-empty">불러오는 중…</div></main></Shell>;
  if (!d) return <Shell><main className="cd-wrap cd-page"><div className="cd-empty">제품을 찾을 수 없어요. <Link href="/chungdam/">처음으로</Link></div></main></Shell>;

  const b = effectiveBasis(d, basis);
  const tags = evidenceTags(d, ds);
  const ins = insights(d, b).slice(0, 2);
  const sweets = sweetNames(d, ds.sweetDefs);
  const samplers = samplersWith(ds, d.id);
  const unit = `100${d.basisUnit || "ml"}`;
  const explain = GLOSSARY.filter((g) =>
    ["당류", "단백질", "열량", "하루 기준치 %", b === "pack" ? "1팩 기준" : "100ml(g) 기준"].includes(g.term) || (g.term === "대체감미료" && sweets.length > 0));
  const q = encodeURIComponent(`${d.maker ? d.maker.replace(/\(주\)|㈜|주식회사/g, "").trim() + " " : ""}${d.name}`);
  const shops = [
    { name: "네이버쇼핑", url: `https://search.shopping.naver.com/search/all?query=${q}` },
    { name: "쿠팡", url: `https://www.coupang.com/np/search?q=${q}` },
  ];

  return (
    <Shell>
      <main className="cd-wrap cd-page">
        <button type="button" className="cd-back" onClick={() => (history.length > 1 ? history.back() : (location.href = "../"))}>← 목록으로</button>
        <div className="cd-dlayout">
          {/* 득근 상세와 같은 배치: 왼쪽 제품 이미지, 오른쪽 요약 → 성분표 → 원재료 → 출처 → 용어 설명 */}
          <div className="cd-dleft">
            <Pack d={d} className="cd-pack hero" />
            <p className="cd-note center">{d.image ? "제품 이미지" : "제품 사진 준비 중 · 포장 형태 일러스트"}</p>
          </div>
          <div className="cd-dright">
            {/* PD-01 기본 정보 · PD-06 태그 */}
            <small className="cd-dmaker">{d.maker || "제조사 정보 없음"}{d.isNew ? <em className="cd-new">NEW</em> : null}</small>
            <h1 className="cd-dname">{d.name}</h1>
            <p className="cd-dsize">{fmtSize(d)} · {d.type}{d.imported ? " · 수입" : ""}</p>
            {d.single ? (
              <div className="cd-sort wide full" role="tablist" aria-label="표시 기준">
                <button type="button" role="tab" aria-selected={b === "pack"} className={b === "pack" ? "on" : ""} onClick={() => setBasis("pack")}>1팩 ({fmtSize(d)})</button>
                <button type="button" role="tab" aria-selected={b === "100"} className={b === "100" ? "on" : ""} onClick={() => setBasis("100")}>{unit}</button>
              </div>
            ) : <p className="cd-res-meta">{unit} 기준 (500ml 초과 대용량)</p>}
            <div className="cd-stats3 big">
              <Stat label="당류" value={nut(d, "sugar", b)} unit="g" />
              <Stat label="단백질" value={nut(d, "protein", b)} unit="g" />
              <Stat label="열량" value={nut(d, "kcal", b)} unit="kcal" />
            </div>
            {ins.length ? <p className="cd-insight">{ins.join(" · ")}</p> : null}
            {tags.length ? <span className="cd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</span> : null}
            <div className="cd-dcta">
              <Link href="/chungdam/#signup" className="cd-btn" onClick={() => ga("signup_start", { from: "detail" })}>출시 알림 받기</Link>
              <a href="#buy" className="cd-btn ghost">구매처 보기</a>
            </div>

        {/* PD-02·03 영양성분 + 기준 환산 */}
        <section className="cd-dcard">
          <h2 className="cd-h2">성분표 · {b === "pack" ? `1팩(${fmtSize(d)})` : unit} · 하루 기준치 %</h2>
          <table className="cd-nut">
            <tbody>
              {NUT_KEYS.map((k) => {
                const v = nut(d, k, b);
                const L = NUT_LABEL[k];
                const pct = dvPercent(k, v);
                return (
                  <tr key={k} className={L.sub && k !== "fiber" ? "sub" : ""}>
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

        {/* PD-04 원재료 */}
        <section className="cd-dcard">
          <h2 className="cd-h2">원재료</h2>
          {ingr === undefined ? <p className="cd-sub">불러오는 중…</p>
            : ingr ? (
              <>
                <p className="cd-ingr">{ingr[0]}</p>
                {sweets.length ? <p className="cd-kv"><b>감미 원료</b>{sweets.join(", ")}</p> : null}
                <p className="cd-kv"><b>알레르기 유발 원료</b>{allergens.length ? allergens.join(", ") : "원재료명에서 확인되지 않음"}</p>
                <p className="cd-note">알레르기 정보는 원재료명 표기에서 찾은 참고용이에요. 복합원재료의 하위 성분은 빠질 수 있으니 구매 전 포장의 알레르기 표시를 꼭 확인하세요. 첨가물의 존재만으로 유해성을 판단하지 않습니다.</p>
              </>
            ) : <p className="cd-sub">아직 원재료 정보를 확보하지 못한 제품이에요. 원재료 기반 태그와 알레르기 정보는 &lsquo;미확인&rsquo; 상태입니다.</p>}
        </section>

        {/* PD-07 데이터 신뢰 */}
        <section className="cd-dcard cd-source">
          <h2 className="cd-h2">출처</h2>
          <dl>
            <dt>영양성분</dt><dd><a href="https://various.foodsafetykorea.go.kr/nutrient/" target="_blank" rel="noopener noreferrer">식약처 식품영양성분DB</a>{ds.summary.baseDate ? ` · 기준일 ${fmtDate(ds.summary.baseDate)}` : ""}</dd>
            <dt>원재료</dt><dd>{ingr ? `식품안전나라 품목제조보고 · 확인일 ${fmtDate(ingr[1])}` : "미확보"}</dd>
            {d.reportNo ? <><dt>품목보고번호</dt><dd>{d.reportNo}</dd></> : null}
            <dt>내부 갱신일</dt><dd>{fmtDate(ds.summary.collected)}</dd>
            <dt>확인 상태</dt><dd>공공데이터 자동 수집 · 제품 라벨 대조 전</dd>
          </dl>
        </section>

        {/* PD-05 쉬운 해설 */}
        <section className="cd-dcard">
          <h2 className="cd-h2">용어 설명</h2>
          <dl className="cd-gloss">
            {explain.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.body}</dd></div>)}
          </dl>
          <p className="cd-note"><b>해석의 한계</b> · 당류가 낮다는 사실만으로 혈당 반응이 낮다고 단정할 수 없어요. 태그는 기준 충족 여부만 뜻하며 효능·인증을 의미하지 않습니다. 개인의 건강 상태에 따른 판단은 전문가와 상담하세요.</p>
        </section>

        {/* PD-08 구매처 */}
        <section className="cd-dcard" id="buy">
          <h2 className="cd-h2">구매처</h2>
          <p className="cd-sub">확인된 판매처·가격 정보는 준비 중이에요. 아래는 제품명으로 검색한 결과 페이지로 이동합니다.</p>
          <div className="cd-shops">
            {shops.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="cd-btn ghost"
                onClick={() => ga("purchase_link_click", { product_id: d.id, seller: s.name, link_type: "search" })}>{s.name}에서 검색 ↗</a>
            ))}
          </div>
        </section>

        {samplers.length ? (
          <section className="cd-dcard">
            <h2 className="cd-h2">이 음료가 들어간 샘플러</h2>
            <div className="cd-samplers mini">
              {samplers.map((s) => (
                <Link key={s.slug} href={`/chungdam/samplers/s/?slug=${s.slug}`} className="cd-scard">
                  <span className="cd-simg"><Picto kind={s.img} /><i>출시 준비 중</i></span>
                  <span className="cd-stxt"><b>{s.name}</b><em>예상가 {won(s.price)}</em></span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

          </div>
        </div>
      </main>
    </Shell>
  );
}
