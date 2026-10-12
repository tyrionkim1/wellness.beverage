"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Basis, Drink, effectiveBasis, fmtDate, fmtNum, fmtSize, insights, nut, proteinShare, Summary, sweetNames, TagDef, tagNames } from "@/lib/data";
import { MAX_COMPARE, MAX_SAMPLER, useCompare, useSampler } from "@/lib/compare";
import { SLOT_OPTIONS, SlotKey } from "@/lib/prefs";
import { track } from "@/lib/track";
import Pack from "./Pack";

export function Header({ active }: { active?: "list" | "compare" | "sampler" | "about" }) {
  const { ids } = useCompare();
  const sampler = useSampler();
  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Link href="/" className="logo" aria-label="득근음료 홈">득근음료</Link>
        <nav className="nav">
          <Link href="/" className={active === "list" ? "on" : ""}>탐색</Link>
          <Link href="/compare/" className={active === "compare" ? "on" : ""}>
            비교{ids.length ? <b className="nav-badge">{ids.length}</b> : null}
          </Link>
          <Link href="/sampler/" className={active === "sampler" ? "on" : ""}>
            샘플러{sampler.ids.length ? <b className="nav-badge">{sampler.ids.length}</b> : null}
          </Link>
          <Link href="/about/" className={active === "about" ? "on" : ""}>방법</Link>
        </nav>
      </div>
    </header>
  );
}

export function UpdateStrip({ s }: { s: Summary | null }) {
  return (
    <div className="upd">
      <div className="wrap upd-in">
        <span className="dot" aria-hidden="true" />
        <span className="mono upd-date">UPDATED {s ? fmtDate(s.collected) : "…"}</span>
        <span className="upd-txt">
          {s ? (
            <>
              음료 <b className="mono">{s.count.toLocaleString("ko-KR")}</b>개 · 신규 <b className="mono">+{s.newCount}</b>
              <span className="upd-src"> · 식약처 기준일 {fmtDate(s.baseDate)}</span>
            </>
          ) : (
            "데이터 불러오는 중"
          )}
        </span>
      </div>
    </div>
  );
}

export function Stat({ label, value, unit, big, note }: { label: string; value: number | null; unit: string; big?: boolean; note?: string }) {
  return (
    <div className={`stat${big ? " big" : ""}`}>
      <span className="stat-l">{label}</span>
      {value === null ? (
        <span className="stat-na">정보 없음</span>
      ) : (
        <span className="stat-v">
          <b className="mono">{fmtNum(value)}</b>
          <i className="mono">{unit}</i>
        </span>
      )}
      {note ? <span className="stat-n">{note}</span> : null}
    </div>
  );
}

export function slotValue(d: Drink, key: SlotKey, b: Basis): number | null {
  if (key === "caffeine") return d.caffeine;
  if (key === "proteinShare") return proteinShare(d);
  return nut(d, key, b);
}

export function ProductCard({ d, onToggle, selected, slots, tagDefs, sweetDefs, inSampler, onSampler }: {
  d: Drink; onToggle: (id: string) => void; selected: boolean; slots: SlotKey[];
  tagDefs: TagDef[]; sweetDefs: TagDef[]; inSampler: boolean; onSampler: (id: string) => void;
}) {
  const b = effectiveBasis(d, "pack");
  const ins = insights(d, b);
  const chips = [...sweetNames(d, sweetDefs).filter((n) => n !== "설탕·당류 원료"), ...tagNames(d, tagDefs).filter((n) => n !== "유제품 원료" && n !== "탄산")].slice(0, 3);
  return (
    <article className="card">
      <Link href={`/p/?id=${encodeURIComponent(d.id)}`} className="card-link">
        <div className="card-head">
          <Pack d={d} className="thumb" />
          <div className="card-title">
            <div className="meta">
              <span className="brand mono">{d.maker || "제조사 정보 없음"}</span>
              {d.isNew ? <span className="tag-new mono">NEW</span> : null}
            </div>
            <h3 className="name">{d.name}</h3>
            <p className="size">
              {fmtSize(d)} · <span className={b === "pack" ? "" : "basis-100"}>{b === "pack" ? "1팩 기준" : `100${d.basisUnit || "ml"} 기준`}</span>
              <span className="type"> · {d.type}</span>
            </p>
          </div>
        </div>
        <div className="stats">
          {slots.map((k) => {
            const o = SLOT_OPTIONS.find((x) => x.key === k)!;
            return <Stat key={k} label={o.label} value={slotValue(d, k, b)} unit={o.unit} />;
          })}
        </div>
        {ins.length ? <p className="insight">{ins.join(" · ")}</p> : null}
        {chips.length || d.taste ? (
          <div className="chips-mini">
            {d.taste ? <span className="mini taste">맛 기록 있음</span> : null}
            {chips.map((c) => <span key={c} className="mini">{c}</span>)}
          </div>
        ) : null}
      </Link>
      <button
        type="button"
        className={`chk${selected ? " on" : ""}`}
        aria-pressed={selected}
        aria-label={selected ? "비교에서 빼기" : "비교에 담기"}
        title="비교에 담기"
        onClick={() => onToggle(d.id)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className={`smp${inSampler ? " on" : ""}`} aria-pressed={inSampler} onClick={() => onSampler(d.id)}>
        {inSampler ? "샘플러 ✓" : "+ 샘플러"}
      </button>
    </article>
  );
}

export function CompareBar() {
  const { ids, clear } = useCompare();
  if (!ids.length) return null;
  return (
    <div className="cbar" role="region" aria-label="비교함">
      <div className="cbar-l">
        <b className="mono">{ids.length}</b>
        <span>/{MAX_COMPARE}개 선택됨</span>
        <button type="button" className="cbar-clear" onClick={clear}>비우기</button>
      </div>
      <Link href={`/compare/?ids=${ids.map(encodeURIComponent).join(",")}`} className="btn-acc">스펙 비교 →</Link>
    </div>
  );
}

let toastSet: ((m: string) => void) | null = null;
export function toast(m: string) {
  toastSet?.(m);
}
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    toastSet = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2200);
    };
    return () => {
      toastSet = null;
      clearTimeout(t);
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function useToggleSampler() {
  const { ids, toggle } = useSampler();
  const onSampler = (id: string) => {
    const r = toggle(id);
    if (r === "full") toast(`샘플러는 최대 ${MAX_SAMPLER}개까지 담을 수 있어요`);
    else if (r === "added") { toast("샘플러에 담았어요"); track("sampler_add", id); }
    else track("sampler_remove", id);
  };
  return { samplerIds: ids, onSampler };
}

export function useToggleCompare() {
  const { ids, toggle } = useCompare();
  const onToggle = (id: string) => {
    const r = toggle(id);
    if (r === "full") toast(`비교는 최대 ${MAX_COMPARE}개까지 담을 수 있어요`);
    else if (r === "added") toast("비교에 담았어요");
  };
  return { ids, onToggle };
}

export function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <p>
          득근음료(가칭) · KAIST 8조 MVP · 데이터 출처: 식품의약품안전처 식품영양성분DB(공공데이터포털). 표시값은 제품 영양성분표 기준이며, 순위·점수·추천을 제공하지 않습니다.
        </p>
        <p><Link href="/about/">분석 방법 보기</Link></p>
      </div>
    </footer>
  );
}
