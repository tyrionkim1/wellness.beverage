"use client";
// 청담음료 MVP 메인 — 요구사항 정의서 v1.1/1.2 기준.
// 내 기준으로 찾기 → 쉽게 이해하기 → 비교·선택 → 출시 알림. 효능 단정·임의 점수 없음.
// 목표 탐색에서 장 건강·면역·수면·피부는 표시광고 검토 전까지 제외(팀 결정). 관심 분야(가입)에는 수요 확인용으로 포함.
import { useEffect, useMemo, useRef, useState } from "react";
import { Dataset, Drink, effectiveBasis, fmtNum, hasTag, loadData, normalize, nut } from "@/lib/data";
import { ga, useGA } from "./ga";
import {
  ARTIFICIAL, DrinkCard, LOW_SUGAR, PROTEIN_PACK, Shell, UpdateStrip,
  Picto, hasSweet, isConcentrate, notProteinComparable,
} from "./shared";

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzhiqqWMEPkYDrEnMOFhdNEB4U1Q_E44JAEa6OkVR7QATYhM9s5tNb4Kqh4D4INXALl/exec";
const CONSENT_VERSION = "2026-10-14.v1";
const PAGE = 24;

type GoalKey = "sugar" | "fat" | "protein" | "plant" | "decaf";
type CondKey = "protein10" | "lactofree" | "fiber" | "probiotic" | "plant" | "noCaffeine";
type ExKey = "artificial" | "sugarSrc" | "altSweet" | "dairy";
type SortKey = "new" | "sugar" | "protein" | "kcal";

const GOALS: { key: GoalKey; label: string }[] = [
  { key: "sugar", label: "당류 관리" },
  { key: "fat", label: "체지방 관리" },
  { key: "protein", label: "단백질 보충" },
  { key: "plant", label: "식물성 식단" },
  { key: "decaf", label: "카페인 줄이기" },
];
const CONDS: { key: CondKey; label: string }[] = [
  { key: "protein10", label: `단백질 ${PROTEIN_PACK}g 이상` },
  { key: "lactofree", label: "락토프리" },
  { key: "plant", label: "식물성 단백 원료" },
  { key: "noCaffeine", label: "카페인 원료 없음" },
  { key: "fiber", label: "식이섬유 원료" },
  { key: "probiotic", label: "유산균 원료" },
];
const EXCLUDES: { key: ExKey; label: string }[] = [
  { key: "artificial", label: "인공감미료" },
  { key: "sugarSrc", label: "설탕·당류 원료" },
  { key: "altSweet", label: "대체감미료 전체" },
  { key: "dairy", label: "유제품 원료" },
];
const ALT_SWEET = ["allulose", "erythritol", "sucralose", "acek", "stevia", "aspartame", "sugaralcohol", "monkfruit"];

const GOAL_PRESET: Record<GoalKey, { conds: CondKey[]; sort: SortKey; sugarMax?: number; kcalMax?: number; ex?: ExKey[] }> = {
  sugar: { conds: [], sort: "sugar", sugarMax: LOW_SUGAR },
  fat: { conds: [], sort: "kcal", sugarMax: 5, kcalMax: 30 },
  protein: { conds: ["protein10"], sort: "protein", sugarMax: 5 },
  plant: { conds: ["plant"], sort: "protein", ex: ["dairy"] },
  decaf: { conds: ["noCaffeine"], sort: "sugar" },
};
const CARDS: { goal: GoalKey; title: string; desc: string; img: string }[] = [
  { goal: "sugar", title: "당류를 줄이고 싶을 때", desc: "100ml당 당류 2.5g 미만부터", img: "sugar" },
  { goal: "protein", title: "단백질을 보충하고 싶을 때", desc: "1팩 단백질 10g 이상 · 당류 5g 이하", img: "protein" },
  { goal: "plant", title: "식물성 음료를 찾을 때", desc: "식물성 단백 원료 · 유제품 원료 없음", img: "plant" },
  { goal: "decaf", title: "카페인을 줄이고 싶을 때", desc: "원재료에 카페인 원료가 없는 음료", img: "decaf" },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "new", label: "최근 등록순" },
  { key: "sugar", label: "당류 낮은 순" },
  { key: "protein", label: "단백질 높은 순" },
  { key: "kcal", label: "열량 낮은 순" },
];
const SUGAR_MAX = 10; // 끝값 = 제한 없음
const KCAL_MAX = 100; // 100ml당, 끝값 = 제한 없음
const NA_MAX = 500; // 1팩 mg, 끝값 = 제한 없음

type F = { conds: Set<CondKey>; ex: Set<ExKey>; sugarMax: number; kcalMax: number; naMax: number };
const EMPTY_F = (): F => ({ conds: new Set(), ex: new Set(), sugarMax: SUGAR_MAX, kcalMax: KCAL_MAX, naMax: NA_MAX });

function runFilter(ds: Dataset, f: F, sort: SortKey, q: string) {
  let missing = 0, conc = 0;
  const needIngr = [...f.conds].some((c) => c !== "protein10") || f.ex.size > 0;
  const out: Drink[] = [];
  const nq = normalize(q.trim());
  for (const d of ds.drinks) {
    if (nq && !d.search.includes(nq)) continue;
    if (isConcentrate(d)) { conc++; continue; }
    const b = effectiveBasis(d, "pack");
    // AND 조건. 판정에 필요한 값이 없으면 '정보 없음'으로 따로 센다(0으로 간주하지 않음)
    if (f.sugarMax < SUGAR_MAX) { const s = d.per100.sugar; if (s === null) { missing++; continue; } if (s > f.sugarMax) continue; }
    if (f.kcalMax < KCAL_MAX) { const k = d.per100.kcal; if (k === null) { missing++; continue; } if (k > f.kcalMax) continue; }
    if (f.naMax < NA_MAX) { const n = nut(d, "sodium", b); if (n === null) { missing++; continue; } if (n > f.naMax) continue; }
    if (f.conds.has("protein10")) {
      const p = nut(d, "protein", b);
      if (p === null) { missing++; continue; }
      if (p < PROTEIN_PACK) continue;
      if (notProteinComparable(d, ds)) { conc++; continue; } // 콜라겐·아미노산·단백 원료 없음 → 단백질 비교 제외
    }
    if (needIngr && !d.hasIngr) { missing++; continue; }
    if (f.conds.has("lactofree") && !hasTag(d, ds.tagDefs, "lactofree")) continue;
    if (f.conds.has("fiber") && !hasTag(d, ds.tagDefs, "fiber_src")) continue;
    if (f.conds.has("probiotic") && !hasTag(d, ds.tagDefs, "probiotic")) continue;
    if (f.conds.has("plant") && !hasTag(d, ds.tagDefs, "plantprotein")) continue;
    if (f.conds.has("noCaffeine") && (hasTag(d, ds.tagDefs, "caffeine_src") || (d.caffeine ?? 0) > 0)) continue;
    if (f.ex.has("artificial") && ARTIFICIAL.some((a) => hasSweet(d, ds.sweetDefs, a))) continue;
    if (f.ex.has("altSweet") && ALT_SWEET.some((a) => hasSweet(d, ds.sweetDefs, a))) continue;
    if (f.ex.has("sugarSrc") && hasSweet(d, ds.sweetDefs, "sugar")) continue;
    if (f.ex.has("dairy") && hasTag(d, ds.tagDefs, "dairy")) continue;
    out.push(d);
  }
  if (sort === "new") {
    out.sort((a, b) => (b.created || "").localeCompare(a.created || "") || a.name.localeCompare(b.name, "ko"));
    return { list: out, missing, conc };
  }
  const key = (d: Drink): number | null =>
    sort === "protein" ? nut(d, "protein", effectiveBasis(d, "pack")) : sort === "kcal" ? d.per100.kcal : d.per100.sugar;
  const dir = sort === "protein" ? -1 : 1;
  out.sort((a, b) => {
    const x = key(a), y = key(b);
    if (x === null && y === null) return a.name.localeCompare(b.name, "ko");
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * dir || a.name.localeCompare(b.name, "ko");
  });
  return { list: out, missing, conc };
}

const scrollTo = (el: HTMLElement | null) => requestAnimationFrame(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }));

// 배치는 득근음료 탐색 화면과 동일: 제목 → 업데이트 줄 → 검색 → 필터 → 프리셋(목표 카드) → 결과 수·정렬 → 카드 그리드
export default function ChungdamView() {
  useGA("landing_view", { device: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop" });
  const [ds, setDs] = useState<Dataset | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [goals, setGoals] = useState<Set<GoalKey>>(new Set());
  const [f, setF] = useState<F>(EMPTY_F);
  const [more, setMore] = useState(false);
  const [sort, setSort] = useState<SortKey>("new");
  const [shown, setShown] = useState(PAGE);
  const resRef = useRef<HTMLElement>(null);
  const signRef = useRef<HTMLElement>(null);

  useEffect(() => { loadData().then(setDs).catch(() => setErr(true)); }, []);
  const result = useMemo(() => (ds ? runFilter(ds, f, sort, q) : null), [ds, f, sort, q]);

  const upd = (p: Partial<F>) => { setF((o) => ({ ...o, ...p })); setShown(PAGE); };
  const toggleSet = <T,>(s: Set<T>, v: T) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; };

  const toggleGoal = (g: GoalKey) => {
    if (goals.has(g)) { setGoals(toggleSet(goals, g)); return; }
    const p = GOAL_PRESET[g];
    setGoals(toggleSet(goals, g));
    setF((o) => ({
      ...o,
      conds: new Set([...o.conds, ...p.conds]),
      ex: new Set([...o.ex, ...(p.ex || [])]),
      sugarMax: p.sugarMax !== undefined ? Math.min(o.sugarMax, p.sugarMax) : o.sugarMax,
      kcalMax: p.kcalMax !== undefined ? Math.min(o.kcalMax, p.kcalMax) : o.kcalMax,
    }));
    setSort(p.sort); setShown(PAGE);
    ga("goal_select", { goal: g });
  };
  const apply = () => {
    ga("filter_apply", { goals: [...goals].join(","), conds: [...f.conds].join(","), exclude: [...f.ex].join(","), sugar_max: f.sugarMax, kcal_max: f.kcalMax, sodium_max: f.naMax, sort, q, result_count: result?.list.length ?? 0 });
    scrollTo(resRef.current);
  };
  const pickCard = (g: GoalKey) => {
    const p = GOAL_PRESET[g];
    setGoals(new Set([g]));
    setF({ conds: new Set(p.conds), ex: new Set(p.ex || []), sugarMax: p.sugarMax ?? SUGAR_MAX, kcalMax: p.kcalMax ?? KCAL_MAX, naMax: NA_MAX });
    setSort(p.sort); setShown(PAGE);
    ga("goal_select", { goal: g, from: "card" });
    scrollTo(resRef.current);
  };
  const reset = () => { setGoals(new Set()); setF(EMPTY_F()); setQ(""); setSort("new"); setShown(PAGE); };

  const chips: { label: string; off: () => void }[] = [
    ...(q.trim() ? [{ label: `검색: ${q.trim()}`, off: () => setQ("") }] : []),
    ...(f.sugarMax < SUGAR_MAX ? [{ label: `당류 ${fmtNum(f.sugarMax)}g 이하/100ml`, off: () => upd({ sugarMax: SUGAR_MAX }) }] : []),
    ...(f.kcalMax < KCAL_MAX ? [{ label: `열량 ${f.kcalMax}kcal 이하/100ml`, off: () => upd({ kcalMax: KCAL_MAX }) }] : []),
    ...(f.naMax < NA_MAX ? [{ label: `나트륨 ${f.naMax}mg 이하/1팩`, off: () => upd({ naMax: NA_MAX }) }] : []),
    ...[...f.conds].map((k) => ({ label: CONDS.find((c) => c.key === k)!.label, off: () => upd({ conds: toggleSet(f.conds, k) }) })),
    ...[...f.ex].map((k) => ({ label: `${EXCLUDES.find((c) => c.key === k)!.label} 제외`, off: () => upd({ ex: toggleSet(f.ex, k) }) })),
  ];

  return (
    <Shell active="find">
      <section className="cd-hero">
        <div className="cd-wrap">
          <h1>매일 마시는 한 잔, 기준 있게.</h1>
          <p className="cd-lead">당류부터 단백질, 원재료까지. 복잡한 음료 성분을 쉽게 비교하고 나에게 맞는 한 잔을 찾아보세요.</p>
          <div className="cd-hero-cta">
            <button type="button" className="cd-btn" onClick={() => scrollTo(document.getElementById("finder"))}>내게 맞는 음료 찾기</button>
            <button type="button" className="cd-btn ghost" onClick={() => { ga("signup_start", { from: "hero" }); scrollTo(signRef.current); }}>출시 알림 받기</button>
          </div>
        </div>
      </section>
      <UpdateStrip s={ds?.summary ?? null} />

      {/* 검색 + 4-2 필터 */}
      <section className="cd-sec" id="finder">
        <div className="cd-wrap">
          <label className="cd-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="제품명 · 제조사 검색" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} aria-label="제품명 또는 제조사 검색" />
          </label>
          <div className="cd-finder">
            <h2>나에게 맞는 음료 찾기</h2>
            <p className="cd-sub">선택한 조건을 모두 만족하는 음료만 아래 목록에 바로 보여드려요.</p>
            <div className="cd-group">
              <h3>나의 목표 <span>복수 선택</span></h3>
              <div className="cd-chips">
                {GOALS.map((g) => (
                  <button key={g.key} type="button" aria-pressed={goals.has(g.key)} className={`cd-chip${goals.has(g.key) ? " on" : ""}`} onClick={() => toggleGoal(g.key)}>{g.label}</button>
                ))}
              </div>
            </div>
            <div className="cd-group">
              <h3>원하는 조건</h3>
              <div className="cd-chips">
                {CONDS.map((c) => (
                  <button key={c.key} type="button" aria-pressed={f.conds.has(c.key)} className={`cd-chip${f.conds.has(c.key) ? " on" : ""}`} onClick={() => upd({ conds: toggleSet(f.conds, c.key) })}>{c.label}</button>
                ))}
              </div>
            </div>
            <Range label="당류 상한" unit="100ml 기준" value={f.sugarMax} max={SUGAR_MAX} step={0.5}
              fmt={(v) => (v >= SUGAR_MAX ? "제한 없음" : `${fmtNum(v)}g 이하`)} onChange={(v) => upd({ sugarMax: v })} />
            <button type="button" className="cd-more" aria-expanded={more} onClick={() => setMore(!more)}>
              {more ? "필터 접기 ▲" : "필터 더 보기 — 열량 · 나트륨 · 제외 원료 ▼"}
            </button>
            {more ? (
              <div className="cd-more-box">
                <Range label="열량 상한" unit="100ml 기준" value={f.kcalMax} max={KCAL_MAX} step={5}
                  fmt={(v) => (v >= KCAL_MAX ? "제한 없음" : `${v}kcal 이하`)} onChange={(v) => upd({ kcalMax: v })} />
                <Range label="나트륨 상한" unit="1팩 기준" value={f.naMax} max={NA_MAX} step={10}
                  fmt={(v) => (v >= NA_MAX ? "제한 없음" : `${v}mg 이하`)} onChange={(v) => upd({ naMax: v })} />
                <div className="cd-group">
                  <h3>제외할 원료 <span>원재료명 표기 기준</span></h3>
                  <div className="cd-chips">
                    {EXCLUDES.map((c) => (
                      <button key={c.key} type="button" aria-pressed={f.ex.has(c.key)} className={`cd-chip ex${f.ex.has(c.key) ? " on" : ""}`} onClick={() => upd({ ex: toggleSet(f.ex, c.key) })}>{c.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="cd-finder-actions">
              <button type="button" className="cd-btn" onClick={apply} disabled={!ds}>
                {ds ? `선택 조건으로 음료 찾기 (${(result?.list.length ?? 0).toLocaleString("ko-KR")}개)` : err ? "데이터를 불러오지 못했어요" : "데이터 불러오는 중…"}
              </button>
              <button type="button" className="cd-reset" onClick={reset}>초기화</button>
            </div>
            <p className="cd-note">조건은 영양성분표 수치와 원재료명 표기만 사용합니다. 원재료 기반 조건은 원재료가 확인된 음료에서만 판정해요. 장 건강·면역·수면·피부 관련 목표는 표시·광고 기준 검토 후 추가 예정입니다.</p>
          </div>
        </div>
      </section>

      {/* 4-3 목표별 추천 (득근의 PRESET 자리) */}
      <section className="cd-sec">
        <div className="cd-wrap">
          <p className="cd-label">목표별 추천</p>
          <div className="cd-cards">
            {CARDS.map((c) => (
              <button key={c.goal} type="button" className="cd-gcard" onClick={() => pickCard(c.goal)}>
                <span className="cd-gimg"><Picto kind={c.img} /></span>
                <span className="cd-gtxt"><b>{c.title}</b><small>{c.desc}</small></span>
                <span className="cd-garrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <p className="cd-note">목표별 추천은 성분 수치·원재료 태그에 따른 규칙 기반 조합이며, 효능을 의미하지 않습니다.</p>
        </div>
      </section>

      {/* 결과 */}
      <section className="cd-sec" ref={resRef} id="results">
        <div className="cd-wrap">
          {!result ? <div className="cd-empty">{err ? "데이터를 불러오지 못했어요." : "불러오는 중…"}</div> : (
            <>
              <div className="cd-res-head">
                <h2 className="cd-count"><b>{result.list.length.toLocaleString("ko-KR")}</b> 개 일치</h2>
                <div className="cd-sort" role="tablist" aria-label="정렬">
                  {SORTS.map((s) => (
                    <button key={s.key} type="button" role="tab" aria-selected={sort === s.key} className={sort === s.key ? "on" : ""} onClick={() => { setSort(s.key); setShown(PAGE); }}>{s.label}</button>
                  ))}
                </div>
              </div>
              {chips.length ? (
                <div className="cd-selchips">
                  {chips.map((c) => <button key={c.label} type="button" onClick={c.off}>{c.label} <span aria-hidden="true">×</span></button>)}
                  <button type="button" className="cd-reset" onClick={reset}>전체 해제</button>
                </div>
              ) : null}
              <p className="cd-res-meta">
                {result.missing ? <>판정에 필요한 정보가 없는 <b>{result.missing.toLocaleString("ko-KR")}</b>개 제외 · </> : null}
                비교 부적합 {result.conc.toLocaleString("ko-KR")}개 제외(농축·분말형·입력 오류 추정값 등)
              </p>
              {result.list.length === 0 ? (
                <div className="cd-empty">조건에 맞는 음료가 없어요. 당류 상한을 올리거나 조건을 하나씩 해제해 보세요.</div>
              ) : (
                <ul className="cd-grid">{result.list.slice(0, shown).map((d) => <DrinkCard key={d.id} d={d} ds={ds!} />)}</ul>
              )}
              {shown < result.list.length ? (
                <button type="button" className="cd-btn ghost block" onClick={() => setShown(shown + PAGE)}>
                  더 보기 ({(result.list.length - shown).toLocaleString("ko-KR")}개 남음)
                </button>
              ) : null}
              <p className="cd-note">정렬은 선택한 기준의 표시값 순서이며 제품 평가가 아닙니다. 값이 없는 음료는 목록 끝에 표시돼요.</p>
            </>
          )}
        </div>
      </section>

      <Signup innerRef={signRef} />
    </Shell>
  );
}

function Range({ label, unit, value, max, step, fmt, onChange }: { label: string; unit: string; value: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="cd-group">
      <h3>{label} <span>{unit}</span></h3>
      <div className="cd-slider">
        <input type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} (${unit})`}
          style={{ ["--p" as string]: `${(value / max) * 100}%` }} />
        <div className="cd-slider-l"><span>0</span><b>{fmt(value)}</b><span>제한 없음</span></div>
      </div>
    </div>
  );
}

const INTERESTS = ["당류 관리", "체지방 관리", "단백질 보충", "식물성 식단", "카페인 줄이기", "운동 후 회복", "장 건강", "면역 건강", "수면·이완", "피부 건강"];

function Signup({ innerRef }: { innerRef: React.RefObject<HTMLElement | null> }) {
  const [email, setEmail] = useState("");
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [agree, setAgree] = useState(false);
  const [mkt, setMkt] = useState(false);
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "dup" | "error">("idle");
  const started = useRef(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const onFocus = () => { if (!started.current) { started.current = true; ga("signup_start", { from: "form" }); } };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!emailOk || !agree || state === "sending") return;
    const key = email.trim().toLowerCase();
    let sent: string[] = [];
    try { sent = JSON.parse(localStorage.getItem("cd.signed.v1") || "[]"); } catch { /* noop */ }
    if (sent.includes(key)) { setState("dup"); return; }
    setState("sending");
    const q = new URLSearchParams(window.location.search);
    const now = new Date().toISOString();
    const payload = {
      kind: "lead", variant: "wellness", email: key, interests: [...picks].join(", "),
      consent: true, consent_version: CONSENT_VERSION, consent_at: now, marketing_opt_in: mkt,
      utm_source: q.get("utm_source") || "mvp_chungdam", utm_medium: q.get("utm_medium") || "", utm_campaign: q.get("utm_campaign") || "",
      referrer: document.referrer || "", page: "chungdam_mvp", ts: now,
    };
    try {
      await fetch(ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      try { localStorage.setItem("cd.signed.v1", JSON.stringify([...sent, key])); } catch { /* noop */ }
      setState("done");
      ga("signup_complete", { interests: payload.interests, marketing_opt_in: mkt }); // 이메일은 GA로 보내지 않음
    } catch {
      setState("error");
    }
  };

  return (
    <section className="cd-sec cd-sign" ref={innerRef} id="signup">
      <div className="cd-wrap">
        <div className="cd-sign-box">
          <h2>출시 소식 가장 먼저 받기</h2>
          <p className="cd-sub">관심 분야를 알려주시면 맞는 음료와 샘플러 소식을 먼저 보내드려요.</p>
          {state === "done" ? (
            <p className="cd-done">신청 완료! 출시 소식을 이메일로 보내드릴게요.</p>
          ) : (
            <form onSubmit={submit} noValidate>
              <h3 className="cd-sign-h">관심 분야 <span>선택 · 복수 가능</span></h3>
              <div className="cd-chips">
                {INTERESTS.map((t) => (
                  <button key={t} type="button" aria-pressed={picks.has(t)} className={`cd-chip${picks.has(t) ? " on" : ""}`}
                    onClick={() => { const n = new Set(picks); if (n.has(t)) n.delete(t); else n.add(t); setPicks(n); onFocus(); }}>{t}</button>
                ))}
              </div>
              <input className={`cd-input${touched && !emailOk ? " bad" : ""}`} type="email" inputMode="email" autoComplete="email" placeholder="이메일 주소 (필수)"
                value={email} onChange={(e) => { setEmail(e.target.value); if (state === "dup") setState("idle"); }} onFocus={onFocus} aria-invalid={touched && !emailOk} />
              {touched && !emailOk ? <p className="cd-err">이메일 형식을 확인해 주세요.</p> : null}
              <label className="cd-agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span><b>[필수]</b> 개인정보 수집·이용 동의 — 수집 항목: 이메일, 관심 분야 / 목적: 출시 알림 발송 / 보유: 출시 후 6개월 또는 철회 시까지. 동의를 거부할 수 있으나 이 경우 알림을 받을 수 없어요.</span>
              </label>
              {touched && !agree ? <p className="cd-err">필수 동의에 체크해 주세요.</p> : null}
              <label className="cd-agree">
                <input type="checkbox" checked={mkt} onChange={(e) => setMkt(e.target.checked)} />
                <span><b>[선택]</b> 신제품·샘플러 등 마케팅 정보 수신 동의</span>
              </label>
              <button type="submit" className="cd-btn block" disabled={state === "sending"}>{state === "sending" ? "보내는 중…" : "출시 알림 신청"}</button>
              {state === "dup" ? <p className="cd-err">이미 신청하신 이메일이에요. 출시 소식을 보내드릴게요.</p> : null}
              {state === "error" ? <p className="cd-err">전송에 실패했어요. 잠시 후 다시 시도해 주세요.</p> : null}
              <p className="cd-note">수신 철회·삭제 요청은 알림 메일 하단 링크 또는 회신으로 언제든 가능해요. 건강 상태 등 민감정보는 수집하지 않습니다.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
