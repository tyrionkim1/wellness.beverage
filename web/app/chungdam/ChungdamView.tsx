"use client";
// 청담음료 MVP (웰니스 버전) — 목표·조건 선택 → 식약처 DB 음료를 공개 기준으로 정렬해 보여준다.
// 규칙: 순위·점수·효능 표현 금지. 영양성분 수치 + 원재료 사실 태그로만 거른다.
// 장 건강·수면·면역·피부 목표는 표시광고 규제 검토 전까지 제외 (팀 결정 10/8).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Pack from "@/components/Pack";
import { Dataset, Drink, TagDef, effectiveBasis, fmtNum, fmtSize, hasTag, loadData, nut } from "@/lib/data";

// ---- 설정 ----
const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzhiqqWMEPkYDrEnMOFhdNEB4U1Q_E44JAEa6OkVR7QATYhM9s5tNb4Kqh4D4INXALl/exec";
const GA_ID = "G-Q7ECW3DL2Y"; // 웰니스 GA4 속성
const PAGE = 24;

type GoalKey = "sugar" | "fat" | "protein" | "plant" | "decaf";
type CondKey = "protein10" | "lactofree" | "fiber" | "probiotic" | "plant" | "noCaffeine" | "noArtificial";
type SortKey = "sugar" | "protein" | "kcal";

const GOALS: { key: GoalKey; label: string }[] = [
  { key: "sugar", label: "당류 관리" },
  { key: "fat", label: "체지방 관리" },
  { key: "protein", label: "단백질 보충" },
  { key: "plant", label: "식물성 식단" },
  { key: "decaf", label: "카페인 줄이기" },
];

const CONDS: { key: CondKey; label: string }[] = [
  { key: "protein10", label: "단백질 10g 이상" },
  { key: "lactofree", label: "락토프리" },
  { key: "fiber", label: "식이섬유 원료" },
  { key: "probiotic", label: "유산균 원료" },
  { key: "plant", label: "식물성 단백 원료" },
  { key: "noCaffeine", label: "카페인 원료 없음" },
  { key: "noArtificial", label: "인공감미료 없음" },
];

// 목표 선택 시 함께 켜지는 조건·정렬 (사용자가 다시 끌 수 있음)
const GOAL_PRESET: Record<GoalKey, { conds: CondKey[]; sort: SortKey; sugarMax?: number }> = {
  sugar: { conds: [], sort: "sugar", sugarMax: 2.5 },
  fat: { conds: [], sort: "kcal", sugarMax: 5 },
  protein: { conds: ["protein10"], sort: "protein" },
  plant: { conds: ["plant"], sort: "protein" },
  decaf: { conds: ["noCaffeine"], sort: "sugar" },
};

const CARDS: { goal: GoalKey; title: string; desc: string; img: string }[] = [
  { goal: "sugar", title: "당류를 줄이고 싶을 때", desc: "100ml당 당류 2.5g 이하부터", img: "photo-1667857410842-ce0a0069acb1" },
  { goal: "protein", title: "단백질을 보충하고 싶을 때", desc: "1팩 단백질 10g 이상", img: "photo-1596633605700-1efc9b49e277" },
  { goal: "plant", title: "식물성 음료를 찾을 때", desc: "대두·귀리·아몬드 등 식물성 단백 원료", img: "photo-1615485737457-f07082c77813" },
  { goal: "decaf", title: "카페인을 줄이고 싶을 때", desc: "원재료에 카페인 원료가 없는 음료", img: "photo-1498604636225-6b87a314baa0" },
];
const img = (id: string) => `https://images.unsplash.com/${id}?w=640&q=70&auto=format&fit=crop`;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "sugar", label: "당류 낮은 순" },
  { key: "protein", label: "단백질 높은 순" },
  { key: "kcal", label: "열량 낮은 순" },
];

const SUGAR_MAX = 10; // 슬라이더 끝값 = 제한 없음
const ARTIFICIAL = ["sucralose", "acek", "aspartame"];

// ---- GA ----
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
}
function ga(event: string, params: Record<string, unknown> = {}) {
  try { window.gtag?.("event", event, { variant: "wellness", page: "chungdam_mvp", ...params }); } catch { /* noop */ }
}
function useGA() {
  useEffect(() => {
    if (window.gtag) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { content_group: "wellness" });
    ga("landing_view");
  }, []);
}

// ---- 필터 ----
function hasSweet(d: Drink, defs: TagDef[], id: string) {
  const i = defs.findIndex(([t]) => t === id);
  return i >= 0 && (d.sweet & (1 << i)) !== 0;
}

type Result = { list: Drink[]; missing: number; conc: number };
// 100ml(g)당 단백질 15g 초과 = 농축·분말·아미노산 제품 추정 → 바로 마시는 음료 비교에서 제외 (값 오류 아님, 범주 차이)
const CONC_PROTEIN = 15;

function runFilter(ds: Dataset, conds: Set<CondKey>, sugarMax: number, sort: SortKey): Result {
  let missing = 0, conc = 0;
  const needIngr = [...conds].some((c) => c !== "protein10");
  const out: Drink[] = [];
  for (const d of ds.drinks) {
    if ((d.per100.protein ?? 0) > CONC_PROTEIN) { conc++; continue; }
    const b = effectiveBasis(d, "pack");
    // 수치가 없으면 '정보 없음'으로 따로 센다 (0으로 채우지 않음)
    if (sugarMax < SUGAR_MAX) {
      const s = d.per100.sugar;
      if (s === null) { missing++; continue; }
      if (s > sugarMax) continue;
    }
    if (conds.has("protein10")) {
      const p = nut(d, "protein", b);
      if (p === null) { missing++; continue; }
      if (p < 10) continue;
    }
    if (needIngr && !d.hasIngr) { missing++; continue; }
    if (conds.has("lactofree") && !hasTag(d, ds.tagDefs, "lactofree")) continue;
    if (conds.has("fiber") && !hasTag(d, ds.tagDefs, "fiber_src")) continue;
    if (conds.has("probiotic") && !hasTag(d, ds.tagDefs, "probiotic")) continue;
    if (conds.has("plant") && !hasTag(d, ds.tagDefs, "plantprotein")) continue;
    if (conds.has("noCaffeine") && (hasTag(d, ds.tagDefs, "caffeine_src") || (d.caffeine ?? 0) > 0)) continue;
    if (conds.has("noArtificial") && ARTIFICIAL.some((a) => hasSweet(d, ds.sweetDefs, a))) continue;
    // 정렬 기준값이 없으면 목록 끝으로 (제외하지 않음)
    out.push(d);
  }
  const key = (d: Drink): number | null => {
    if (sort === "protein") return nut(d, "protein", effectiveBasis(d, "pack"));
    if (sort === "kcal") return d.per100.kcal;
    return d.per100.sugar;
  };
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

// ---- 화면 ----
export default function ChungdamView() {
  useGA();
  const [ds, setDs] = useState<Dataset | null>(null);
  const [err, setErr] = useState(false);
  const [goals, setGoals] = useState<Set<GoalKey>>(new Set());
  const [conds, setConds] = useState<Set<CondKey>>(new Set());
  const [sugarMax, setSugarMax] = useState(5);
  const [sort, setSort] = useState<SortKey>("sugar");
  const [applied, setApplied] = useState<{ conds: Set<CondKey>; sugarMax: number } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const resRef = useRef<HTMLElement>(null);
  const finderRef = useRef<HTMLElement>(null);
  const signRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadData().then(setDs).catch(() => setErr(true));
  }, []);

  const toggleGoal = (g: GoalKey) => {
    const next = new Set(goals);
    if (next.has(g)) next.delete(g);
    else {
      next.add(g);
      const p = GOAL_PRESET[g];
      setConds((c) => new Set([...c, ...p.conds]));
      setSort(p.sort);
      if (p.sugarMax !== undefined) setSugarMax((m) => Math.min(m, p.sugarMax!));
      ga("goal_select", { goal: g });
    }
    setGoals(next);
  };
  const toggleCond = (c: CondKey) => {
    const next = new Set(conds);
    if (next.has(c)) next.delete(c); else next.add(c);
    setConds(next);
  };

  const apply = (c = conds, s = sugarMax) => {
    setApplied({ conds: new Set(c), sugarMax: s });
    setShown(PAGE);
    ga("filter_apply", { goals: [...goals].join(","), conds: [...c].join(","), sugar_max: s, sort });
    requestAnimationFrame(() => resRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const pickCard = (g: GoalKey) => {
    const p = GOAL_PRESET[g];
    const c = new Set<CondKey>(p.conds);
    const s = p.sugarMax ?? SUGAR_MAX;
    setGoals(new Set([g]));
    setConds(c);
    setSugarMax(s);
    setSort(p.sort);
    ga("goal_card_click", { goal: g });
    setApplied({ conds: c, sugarMax: s });
    setShown(PAGE);
    requestAnimationFrame(() => resRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const result = useMemo(
    () => (ds && applied ? runFilter(ds, applied.conds, applied.sugarMax, sort) : null),
    [ds, applied, sort],
  );

  const sugarText = sugarMax >= SUGAR_MAX ? "제한 없음" : `${fmtNum(sugarMax)}g 이하`;

  return (
    <div className="cd">
      <header className="cd-hdr">
        <div className="cd-wrap cd-hdr-in">
          <Link href="/chungdam/" className="cd-logo">청담음료</Link>
          <nav className="cd-nav">
            <button type="button" onClick={() => finderRef.current?.scrollIntoView({ behavior: "smooth" })}>음료 찾기</button>
            <button type="button" onClick={() => signRef.current?.scrollIntoView({ behavior: "smooth" })}>출시 알림</button>
          </nav>
        </div>
      </header>

      <section className="cd-hero">
        <div className="cd-wrap">
          <p className="cd-eyebrow">건강음료 큐레이션</p>
          <h1>매일 마시는 한 잔,<br />기준 있게.</h1>
          <p className="cd-lead">
            당류부터 단백질, 원재료까지. 복잡한 음료 성분을 쉽게 비교하고 나에게 맞는 한 잔을 찾아보세요.
          </p>
          <div className="cd-hero-cta">
            <button type="button" className="cd-btn" onClick={() => finderRef.current?.scrollIntoView({ behavior: "smooth" })}>
              내게 맞는 음료 찾기
            </button>
            <button type="button" className="cd-btn ghost" onClick={() => { ga("signup_start", { from: "hero" }); signRef.current?.scrollIntoView({ behavior: "smooth" }); }}>
              출시 알림 받기
            </button>
          </div>
          <p className="cd-src">
            식약처 식품영양성분DB 음료 {ds ? <b>{ds.summary.count.toLocaleString("ko-KR")}</b> : "…"}개 기준
          </p>
        </div>
      </section>

      {/* 4-2 나에게 맞는 음료 찾기 */}
      <section className="cd-sec" ref={finderRef} id="finder">
        <div className="cd-wrap">
          <div className="cd-finder">
            <h2>나에게 맞는 음료 찾기</h2>
            <p className="cd-sub">목표와 원하는 조건을 고르면 공개된 성분 수치로 걸러드려요.</p>

            <div className="cd-group">
              <h3>나의 목표 <span>복수 선택</span></h3>
              <div className="cd-chips">
                {GOALS.map((g) => (
                  <button key={g.key} type="button" aria-pressed={goals.has(g.key)} className={`cd-chip${goals.has(g.key) ? " on" : ""}`} onClick={() => toggleGoal(g.key)}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="cd-group">
              <h3>원하는 조건</h3>
              <div className="cd-chips">
                {CONDS.map((c) => (
                  <button key={c.key} type="button" aria-pressed={conds.has(c.key)} className={`cd-chip${conds.has(c.key) ? " on" : ""}`} onClick={() => toggleCond(c.key)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="cd-group">
              <h3>당류 상한 <span>100ml 기준</span></h3>
              <div className="cd-slider">
                <input
                  type="range" min={0} max={SUGAR_MAX} step={0.5} value={sugarMax}
                  onChange={(e) => setSugarMax(Number(e.target.value))}
                  aria-label="100ml당 당류 상한"
                  style={{ ["--p" as string]: `${(sugarMax / SUGAR_MAX) * 100}%` }}
                />
                <div className="cd-slider-l"><span>0g</span><b>{sugarText}</b><span>제한 없음</span></div>
              </div>
            </div>

            <button type="button" className="cd-btn block" onClick={() => apply()} disabled={!ds}>
              {ds ? "선택 조건으로 음료 찾기" : err ? "데이터를 불러오지 못했어요" : "데이터 불러오는 중…"}
            </button>
            <p className="cd-note">
              장 건강·수면 등 기능성 목표는 표시·광고 기준 검토 후 추가 예정입니다. 조건은 영양성분표 수치와 원재료명 표기만 사용합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 4-3 목표별 추천 */}
      <section className="cd-sec">
        <div className="cd-wrap">
          <h2 className="cd-h2">목표별로 바로 보기</h2>
          <div className="cd-cards">
            {CARDS.map((c) => (
              <button key={c.goal} type="button" className="cd-gcard" onClick={() => pickCard(c.goal)}>
                <span className="cd-gimg"><img src={img(c.img)} alt="" loading="lazy" /></span>
                <span className="cd-gtxt">
                  <b>{c.title}</b>
                  <small>{c.desc}</small>
                </span>
                <span className="cd-garrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 결과 */}
      <section className="cd-sec" ref={resRef} id="results">
        <div className="cd-wrap">
          {!result ? (
            <div className="cd-empty">조건을 고르고 <b>음료 찾기</b>를 누르면 여기에 결과가 나와요.</div>
          ) : (
            <>
              <div className="cd-res-head">
                <h2 className="cd-h2">
                  조건에 맞는 음료 <b>{result.list.length.toLocaleString("ko-KR")}</b>개
                </h2>
                <div className="cd-sort" role="tablist" aria-label="정렬">
                  {SORTS.map((s) => (
                    <button key={s.key} type="button" role="tab" aria-selected={sort === s.key} className={sort === s.key ? "on" : ""} onClick={() => setSort(s.key)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="cd-res-meta">
                당류 {applied!.sugarMax >= SUGAR_MAX ? "제한 없음" : `100ml당 ${fmtNum(applied!.sugarMax)}g 이하`}
                {[...applied!.conds].map((k) => ` · ${CONDS.find((c) => c.key === k)!.label}`).join("")}
                {result.missing ? <> · 수치·원재료 정보 없음 <b>{result.missing.toLocaleString("ko-KR")}</b>개 제외</> : null}
                {result.conc ? <> · 농축·분말형 추정 {result.conc.toLocaleString("ko-KR")}개 제외</> : null}
              </p>
              {result.list.length === 0 ? (
                <div className="cd-empty">조건을 조금 풀어보세요. 당류 상한을 올리거나 조건 수를 줄이면 더 많이 보여요.</div>
              ) : (
                <ul className="cd-list">
                  {result.list.slice(0, shown).map((d) => <DrinkCard key={d.id} d={d} ds={ds!} />)}
                </ul>
              )}
              {shown < result.list.length ? (
                <button type="button" className="cd-btn ghost block" onClick={() => setShown(shown + PAGE)}>
                  더 보기 ({(result.list.length - shown).toLocaleString("ko-KR")}개 남음)
                </button>
              ) : null}
              <p className="cd-note">정렬은 선택한 기준의 표시값 순서이며, 제품 평가·순위가 아닙니다.</p>
            </>
          )}
        </div>
      </section>

      <Signup innerRef={signRef} />

      <footer className="cd-ftr">
        <div className="cd-wrap">
          <p>청담음료(가칭) · KAIST MBA 8조 MVP</p>
          <p>데이터 출처: 식품의약품안전처 식품영양성분DB(공공데이터포털). 표시값은 제품 영양성분표 기준이며 질병의 예방·치료 효과를 의미하지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
}

function DrinkCard({ d, ds }: { d: Drink; ds: Dataset }) {
  const b = effectiveBasis(d, "pack");
  const tags = [
    hasTag(d, ds.tagDefs, "lactofree") && "락토프리",
    hasTag(d, ds.tagDefs, "plantprotein") && "식물성 단백",
    hasTag(d, ds.tagDefs, "fiber_src") && "식이섬유 원료",
    hasTag(d, ds.tagDefs, "probiotic") && "유산균 원료",
  ].filter(Boolean) as string[];
  const v = (k: "sugar" | "protein" | "kcal") => nut(d, k, b);
  return (
    <li className="cd-item">
      <Link href={`/p/?id=${encodeURIComponent(d.id)}`} onClick={() => ga("product_view", { id: d.id, name: d.name })}>
        <Pack d={d} className="cd-pack" />
        <span className="cd-info">
          <small>{d.maker || "제조사 정보 없음"}</small>
          <b>{d.name}</b>
          <em>{fmtSize(d)} · {b === "pack" ? "1팩 기준" : `100${d.basisUnit || "ml"} 기준`}</em>
          <span className="cd-nums">
            <span>당류 <i>{v("sugar") === null ? "정보 없음" : `${fmtNum(v("sugar"))}g`}</i></span>
            <span>단백질 <i>{v("protein") === null ? "정보 없음" : `${fmtNum(v("protein"))}g`}</i></span>
            <span>열량 <i>{v("kcal") === null ? "정보 없음" : `${fmtNum(v("kcal"))}kcal`}</i></span>
          </span>
          {tags.length ? <span className="cd-tags">{tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}</span> : null}
        </span>
      </Link>
    </li>
  );
}

const INTERESTS = ["당류 관리", "단백질 보충", "식물성 음료", "카페인 줄이기", "체지방 관리"];

function Signup({ innerRef }: { innerRef: React.RefObject<HTMLElement | null> }) {
  const [email, setEmail] = useState("");
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const started = useRef(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && agree;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || state === "sending") return;
    setState("sending");
    const q = new URLSearchParams(window.location.search);
    const payload = {
      kind: "lead",
      variant: "wellness",
      email,
      interests: [...picks].join(", "),
      consent: true,
      utm_source: q.get("utm_source") || "mvp_chungdam",
      utm_medium: q.get("utm_medium") || "",
      utm_campaign: q.get("utm_campaign") || "",
      page: "chungdam_mvp",
      ts: new Date().toISOString(),
    };
    try {
      await fetch(ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      setState("done");
      ga("signup_complete", { interests: payload.interests });
    } catch {
      setState("error");
    }
  };

  const onFocus = () => {
    if (!started.current) { started.current = true; ga("signup_start", { from: "form" }); }
  };

  return (
    <section className="cd-sec cd-sign" ref={innerRef} id="signup">
      <div className="cd-wrap">
        <div className="cd-sign-box">
          <h2>출시 소식 가장 먼저 받기</h2>
          <p className="cd-sub">관심 있는 목표를 알려주시면 맞는 음료 소식을 먼저 보내드려요.</p>
          {state === "done" ? (
            <p className="cd-done">신청 완료! 출시 소식을 이메일로 보내드릴게요.</p>
          ) : (
            <form onSubmit={submit}>
              <div className="cd-chips">
                {INTERESTS.map((t) => (
                  <button key={t} type="button" aria-pressed={picks.has(t)} className={`cd-chip${picks.has(t) ? " on" : ""}`}
                    onClick={() => { const n = new Set(picks); if (n.has(t)) n.delete(t); else n.add(t); setPicks(n); onFocus(); }}>
                    {t}
                  </button>
                ))}
              </div>
              <input className="cd-input" type="email" inputMode="email" autoComplete="email" placeholder="이메일 주소"
                value={email} onChange={(e) => setEmail(e.target.value)} onFocus={onFocus} required />
              <label className="cd-agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>출시 알림 발송을 위한 이메일 수집·이용에 동의합니다. (출시 후 6개월 내 파기)</span>
              </label>
              <button type="submit" className="cd-btn block" disabled={!valid || state === "sending"}>
                {state === "sending" ? "보내는 중…" : "출시 알림 신청"}
              </button>
              {state === "error" ? <p className="cd-err">전송에 실패했어요. 잠시 후 다시 시도해 주세요.</p> : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
