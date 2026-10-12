"use client";
// FR-3 성분 상세 (출처·수집일자) · FR-8 용어 설명 · 1일 기준치 % · 원재료 · 맛 기록 · 샘플러
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Basis, CAFFEINE_DAILY_MAX, Dataset, Drink, dvPercent, fmtDate, fmtNum, fmtSize, insights, loadData, loadIngredients,
  nut, NUT_LABEL, Nutrients, proteinShare, sweetNames, tagNames,
} from "@/lib/data";
import { GLOSSARY, GLOSSARY_STATUS } from "@/lib/glossary";
import { track } from "@/lib/track";
import { CompareBar, Footer, Header, Stat, useToggleCompare, useToggleSampler } from "./ui";
import Pack from "./Pack";

const TABLE_ORDER: (keyof Nutrients)[] = ["kcal", "carb", "sugar", "fiber", "protein", "fat", "satFat", "transFat", "chol", "sodium", "potassium"];
const AXES = ["단맛", "산미", "탄산", "바디감", "뒷맛"];
const LEVEL = ["", "약", "중", "강"];

export default function DetailView() {
  const id = useSearchParams().get("id") || "";
  const router = useRouter();
  const [data, setData] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [basis, setBasis] = useState<Basis>("pack");

  useEffect(() => {
    loadData().then(setData).catch((e) => setErr(String(e.message || e)));
  }, []);

  const d: Drink | undefined = data?.byId.get(id);
  useEffect(() => {
    if (d) {
      document.title = `${d.name} — 득근음료`;
      track("detail_open", d.id);
      if (d.taste) track("taste_view", d.id);
    }
  }, [d]);

  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));

  return (
    <>
      <Header />
      <main className="wrap">
        <button type="button" className="back" onClick={back}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          목록으로
        </button>
        {err ? (
          <div className="empty"><h3>데이터를 불러오지 못했어요</h3><p>{err}</p></div>
        ) : !data ? (
          <div className="skel" style={{ height: 420, marginTop: 12 }} />
        ) : !d ? (
          <div className="empty">
            <h3>DB에 없는 제품이에요</h3>
            <p>식품코드 <span className="mono">{id || "(없음)"}</span> 에 해당하는 제품을 찾지 못했어요. 식약처 DB에서 빠졌거나 링크가 잘못됐을 수 있습니다.</p>
            <p><Link href="/" style={{ textDecoration: "underline" }}>목록에서 다시 찾기</Link></p>
          </div>
        ) : (
          <Body d={d} data={data} basis={d.single ? basis : "100"} setBasis={setBasis} />
        )}
      </main>
      <Footer />
      <CompareBar />
    </>
  );
}

function Body({ d, data, basis, setBasis }: { d: Drink; data: Dataset; basis: Basis; setBasis: (b: Basis) => void }) {
  const { ids, onToggle } = useToggleCompare();
  const { samplerIds, onSampler } = useToggleSampler();
  const [ingr, setIngr] = useState<[string, string] | null | undefined>(undefined);
  useEffect(() => {
    setIngr(undefined);
    if (d.hasIngr) loadIngredients(d.id).then(setIngr);
    else setIngr(null);
  }, [d]);

  const bu = d.basisUnit || "ml";
  const ins = insights(d, basis);
  const share = proteinShare(d);
  const sw = sweetNames(d, data.sweetDefs);
  const tg = tagNames(d, data.tagDefs);
  const selected = ids.includes(d.id);
  const inSampler = samplerIds.includes(d.id);

  return (
    <div className="dlayout">
      <div className="dside">
        <div className="stage"><Pack d={d} className="big-pack" /></div>
        {!d.image ? <p className="img-note">제품 사진 준비 중 · 포장 형태 일러스트</p> : <p className="img-note">이미지 출처: 제조사 공개 이미지</p>}
      </div>

      <div style={{ display: "grid", gap: 22 }}>
        <div className="dtitle">
          <div className="meta">
            <span className="brand mono" style={{ fontSize: 12 }}>{d.maker || "제조사 정보 없음"}</span>
            {d.isNew ? <span className="tag-new mono">NEW</span> : null}
          </div>
          <h1>{d.name}</h1>
          <span className="sub">{fmtSize(d)} · {d.type}{d.imported ? " · 수입" : ""}</span>
        </div>

        <div className="seg" role="group" aria-label="표시 기준">
          <button type="button" className={basis === "pack" ? "on" : ""} disabled={!d.single} onClick={() => setBasis("pack")}>
            1팩{d.single ? ` (${fmtSize(d)})` : ""}
          </button>
          <button type="button" className={basis === "100" ? "on" : ""} onClick={() => setBasis("100")}>100{bu}</button>
        </div>
        {!d.single ? (
          <p className="note">
            {d.size && d.size > 500 ? "500ml(g)을 넘는 대용량이라 100" + bu + " 기준으로만 보여줍니다." : "용량 정보가 없거나 기준 단위가 달라 100" + bu + " 기준으로만 보여줍니다."}
          </p>
        ) : null}

        <div className="keystats">
          <Stat big label="단백질" value={nut(d, "protein", basis)} unit="g" note={share !== null ? `열량의 ${share}%` : undefined} />
          <Stat big label="당류" value={nut(d, "sugar", basis)} unit="g" />
          <Stat big label="열량" value={nut(d, "kcal", basis)} unit="kcal" />
        </div>
        {ins.length ? <p className="insight" style={{ fontSize: 14 }}>{ins.join(" · ")}</p> : null}

        <div className="cactions" style={{ padding: 0 }}>
          <button type="button" className={inSampler ? "btn-line" : "btn-acc"} style={{ padding: 14 }} onClick={() => onSampler(d.id)}>
            {inSampler ? "샘플러에서 빼기" : "샘플러에 담기 +"}
          </button>
          <button type="button" className={selected ? "btn-line" : "btn-ink"} onClick={() => onToggle(d.id)}>
            {selected ? "비교에서 빼기" : "비교에 담기"}
          </button>
        </div>

        <section className="sec" aria-labelledby="h-taste">
          <h2 id="h-taste">맛 기록</h2>
          {d.taste ? (
            <div className="taste-box">
              {d.taste[0] ? <p className="anchor">“{d.taste[0]}”</p> : null}
              {d.taste[1].map((lv, i) => (lv ? (
                <div key={i} className="axis">
                  <span>{AXES[i]}</span>
                  <span className="bar">{[1, 2, 3].map((x) => <i key={x} className={x <= lv ? "on" : ""} />)}</span>
                  <span>{LEVEL[lv]}</span>
                </div>
              ) : null))}
              {d.taste[4] ? <p className="note">{d.taste[4]}</p> : null}
              <p className="note">팀 시음 패널 {d.taste[2]}명 · {fmtDate(d.taste[3])} · 개인 감각 기록이며 평가·순위가 아닙니다.</p>
            </div>
          ) : (
            <div className="taste-empty">
              <b style={{ color: "var(--ink)" }}>아직 맛 기록이 없어요</b>
              <span>샘플러에 담아 두면, 맛 기록이 생기거나 샘플러가 열릴 때 알려드릴게요.</span>
            </div>
          )}
        </section>

        <section className="sec" aria-labelledby="h-table">
          <h2 id="h-table">성분표 · {basis === "pack" ? `1팩(${fmtSize(d)})` : `100${bu}`} · 하루 기준치 %</h2>
          <div className="ntable">
            {TABLE_ORDER.map((k) => {
              const v = nut(d, k, basis);
              if ((k === "fiber" || k === "potassium") && v === null) return null;
              const L = NUT_LABEL[k];
              const pct = dvPercent(k, v);
              return (
                <div key={k} className={`nrow${L.sub ? " sub" : ""}`}>
                  <span className="k">{L.sub ? "└ " : ""}{L.label}</span>
                  <div className="dvwrap">
                    {v === null ? <span className="na">정보 없음</span> : <span className="v"><b>{fmtNum(v)}</b><i>{L.unit}</i></span>}
                    {pct !== null ? (
                      <>
                        <span className="dvbar" aria-hidden="true"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
                        <span className="dvtxt">하루 기준치 {pct}%</span>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div className="nrow">
              <span className="k">카페인</span>
              <div className="dvwrap">
                {d.caffeine === null ? <span className="na">입력 전</span> : <span className="v"><b>{fmtNum(d.caffeine)}</b><i>mg</i></span>}
                {d.caffeine !== null ? <span className="dvtxt">하루 최대 권고량 {Math.round((d.caffeine / CAFFEINE_DAILY_MAX) * 100)}%</span> : null}
              </div>
            </div>
          </div>
          <p className="note">하루 기준치: 식품 등의 표시기준 1일 영양성분 기준치(단백질 55g · 당류 100g · 나트륨 2,000mg 등). 카페인은 성인 1일 최대 섭취권고량 400mg 기준. 평가가 아닌 비교용 환산입니다.</p>
        </section>

        <section className="sec" aria-labelledby="h-ingr">
          <h2 id="h-ingr">원재료</h2>
          {sw.length || tg.length ? (
            <div className="chips-mini">
              {sw.map((n) => <span key={n} className="mini" style={{ color: "var(--ink)" }}>감미료 · {n}</span>)}
              {tg.map((n) => <span key={n} className="mini">{n}</span>)}
            </div>
          ) : null}
          {ingr === undefined ? (
            <div className="skel" style={{ height: 60 }} />
          ) : ingr ? (
            <>
              <p className="ingr">{ingr[0]}</p>
              <p className="note">출처: 식품안전나라 품목제조보고(원재료) · 확인일 {fmtDate(ingr[1])} · 원재료명 표기 기준이며, 복합원재료의 하위 성분은 빠질 수 있어요. 태그는 효능·인증을 뜻하지 않습니다.</p>
            </>
          ) : (
            <p className="note">원재료 정보를 아직 확보하지 못했어요{d.imported ? " (수입식품은 품목제조보고 대상이 아님)" : ""}. 제품 포장의 원재료명을 확인해 주세요.</p>
          )}
        </section>

        <section className="sec" aria-labelledby="h-src">
          <h2 id="h-src">출처</h2>
          <dl className="srcbox">
            <div><dt>영양성분</dt><dd>식품의약품안전처 식품영양성분DB (가공식품 · 음료류)</dd></div>
            <div><dt>데이터 등록일</dt><dd>{fmtDate(d.created)}</dd></div>
            <div><dt>수집일</dt><dd>{fmtDate(data.summary.collected)}</dd></div>
            <div><dt>식품코드</dt><dd className="mono">{d.id}</dd></div>
            {d.reportNo ? <div><dt>품목보고번호</dt><dd className="mono">{d.reportNo}</dd></div> : null}
            <div><dt>카페인</dt><dd>{d.caffeine !== null ? "제품 표시사항 기준 · 약사 확인" : "식약처 DB에 항목 없음 · 입력 전"}</dd></div>
          </dl>
          <p className="note">1팩 값 = 100{bu} 기준 수치 × 용량 ÷ 100 (소수 첫째 자리 반올림). 표시값은 제품 영양성분표 기준이며 광고 문구와 무관합니다.</p>
        </section>

        <section className="sec" aria-labelledby="h-gl">
          <h2 id="h-gl">용어 설명</h2>
          {GLOSSARY.map((g) => (
            <div key={g.term} className="gl"><b>{g.term}</b><p>{g.body}</p></div>
          ))}
          <p className="note">{GLOSSARY_STATUS === "draft" ? "용어 설명 초안 — 약사 감수 진행 중." : "약사 감수 완료."} 질병·효능 표현은 쓰지 않습니다.</p>
        </section>
      </div>
    </div>
  );
}
