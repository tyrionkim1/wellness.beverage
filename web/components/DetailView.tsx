"use client";
// FR-3 성분 상세 (출처·수집일자 표기) · FR-8 용어 설명
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Basis, Dataset, Drink, fmtDate, fmtNum, fmtSize, loadData, nut, NUT_LABEL, Nutrients } from "@/lib/data";
import { GLOSSARY, GLOSSARY_STATUS } from "@/lib/glossary";
import { CompareBar, Footer, Header, Stat, useToggleCompare } from "./ui";
import Pack from "./Pack";

const TABLE_ORDER: (keyof Nutrients)[] = ["kcal", "carb", "sugar", "protein", "fat", "satFat", "transFat", "chol", "sodium"];

export default function DetailView() {
  const id = useSearchParams().get("id") || "";
  const router = useRouter();
  const [data, setData] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [basis, setBasis] = useState<Basis>("pack");
  const { ids, onToggle } = useToggleCompare();

  useEffect(() => {
    loadData().then(setData).catch((e) => setErr(String(e.message || e)));
  }, []);

  const d: Drink | undefined = data?.byId.get(id);
  useEffect(() => {
    if (d) document.title = `${d.name} — 청담음료`;
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
          <Body d={d} basis={d.single ? basis : "100"} setBasis={setBasis} selected={ids.includes(d.id)} onToggle={onToggle} collected={data.summary.collected} />
        )}
      </main>
      <Footer />
      <CompareBar />
    </>
  );
}

function Body({ d, basis, setBasis, selected, onToggle, collected }: {
  d: Drink; basis: Basis; setBasis: (b: Basis) => void; selected: boolean; onToggle: (id: string) => void; collected: string;
}) {
  const bu = d.basisUnit || "ml";
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
          <Stat big label="단백질" value={nut(d, "protein", basis)} unit="g" />
          <Stat big label="당류" value={nut(d, "sugar", basis)} unit="g" />
          <Stat big label="카페인" value={d.caffeine} unit="mg" note={d.caffeine !== null ? "1팩 · 표시사항" : undefined} />
        </div>

        <section className="sec" aria-labelledby="h-table">
          <h2 id="h-table">전체 성분표 · {basis === "pack" ? `1팩(${fmtSize(d)})` : `100${bu}`} 기준</h2>
          <div className="ntable">
            {TABLE_ORDER.map((k) => {
              const v = nut(d, k, basis);
              const L = NUT_LABEL[k];
              return (
                <div key={k} className={`nrow${L.sub ? " sub" : ""}`}>
                  <span className="k">{L.sub ? "└ " : ""}{L.label}</span>
                  {v === null ? <span className="na">정보 없음</span> : <span className="v"><b>{fmtNum(v)}</b><i>{L.unit}</i></span>}
                </div>
              );
            })}
          </div>
          <dl className="srcbox">
            <div><dt>출처</dt><dd>식품의약품안전처 식품영양성분DB (가공식품 · 음료류)</dd></div>
            <div><dt>데이터 등록일</dt><dd>{fmtDate(d.created)}</dd></div>
            <div><dt>수집일</dt><dd>{fmtDate(collected)}</dd></div>
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

        <button type="button" className={selected ? "btn-line" : "btn-acc"} style={{ padding: 16, fontSize: 15 }} onClick={() => onToggle(d.id)}>
          {selected ? "비교에서 빼기" : "비교에 담기 +"}
        </button>
      </div>
    </div>
  );
}
