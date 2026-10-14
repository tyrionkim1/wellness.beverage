"use client";
// 청담음료 공용 — 헤더/푸터, 제품 카드, 판정 규칙, 랭킹·샘플러 정의.
// 원칙(요구사항 2.3·4.2·4.3): 수치 없음 ≠ 0, 기준 공개, 효능 단정 금지, 근거 있는 태그만.
import Link from "next/link";
import Pack from "@/components/Pack";
import { Dataset, Drink, Summary, TagDef, effectiveBasis, fmtDate, fmtNum, fmtSize, hasTag, insights, nut } from "@/lib/data";
import { ga } from "./ga";

// ---- 판정 규칙 (화면 '기준 안내'와 동일하게 유지) ----
export const CONC_PROTEIN = 10; // 100ml(g)당 단백질 10g 초과 → 농축·분말형 또는 입력 오류 추정, 바로 마시는 음료 비교에서 제외
export const LOW_SUGAR = 2.5; // 100ml당 당류 2.5g 미만 → '저당 기준 충족'(식품 등의 표시기준 음료 저당 기준)
export const NO_SUGAR = 0.5; // 100ml당 당류 0.5g 미만 → '무당 기준 충족'
export const PROTEIN_PACK = 10; // 1팩 단백질 10g 이상
export const ARTIFICIAL = ["sucralose", "acek", "aspartame"];

/** 비교에서 제외: 농축·분말형 추정(단백질 과다) 또는 단백질 열량이 총열량을 넘는 값(입력 오류 추정) */
export const isConcentrate = (d: Drink) => {
  const p = d.per100.protein, k = d.per100.kcal;
  if (p === null) return false;
  if (p > CONC_PROTEIN) return true;
  return k !== null && p * 4 > k * 1.1 + 2;
};
/** 콜라겐·아미노산(아르기닌 등) 제품은 '단백질' 수치가 일반 단백질 음료와 비교되지 않아 단백질 랭킹에서 제외 */
const NOT_PROTEIN_DRINK = /콜라겐|아르기닌|아미노|펩타이드|펩티드/;
export const notProteinComparable = (d: Drink, ds: Dataset) =>
  NOT_PROTEIN_DRINK.test(d.name) ||
  (d.hasIngr && (hasTag(d, ds.tagDefs, "collagen") || hasTag(d, ds.tagDefs, "amino") ||
    !["dairy", "plantprotein", "animalprotein"].some((t) => hasTag(d, ds.tagDefs, t)))); // 원재료에 단백 원료가 없으면 단백질 값 신뢰 불가
/** 같은 제품의 용량 변형('(330ml)' 등)을 하나로 묶는 키 */
const baseName = (d: Drink) => `${d.maker}|${d.name.replace(/\s*[\[(（][^\])）]*[\])）]\s*/g, " ").replace(/\s+/g, "").toLowerCase()}`;
export function hasSweet(d: Drink, defs: TagDef[], id: string) {
  const i = defs.findIndex(([t]) => t === id);
  return i >= 0 && (d.sweet & (1 << i)) !== 0;
}
export const packProtein = (d: Drink) => nut(d, "protein", effectiveBasis(d, "pack"));

/** 근거가 확인된 태그만 (PD-06). 원재료가 없으면 원재료 기반 태그는 붙이지 않는다. */
export function evidenceTags(d: Drink, ds: Dataset): string[] {
  const out: string[] = [];
  const s = d.per100.sugar;
  if (s !== null && s < NO_SUGAR) out.push("무당 기준 충족");
  else if (s !== null && s < LOW_SUGAR) out.push("저당 기준 충족");
  const p = packProtein(d);
  if (p !== null && p >= PROTEIN_PACK && !isConcentrate(d)) out.push(`단백질 ${PROTEIN_PACK}g↑`);
  if (d.hasIngr) {
    if (hasTag(d, ds.tagDefs, "lactofree")) out.push("락토프리 표기");
    if (hasTag(d, ds.tagDefs, "plantprotein") && !hasTag(d, ds.tagDefs, "dairy")) out.push("식물성 단백");
    if (!hasTag(d, ds.tagDefs, "caffeine_src") && !(d.caffeine && d.caffeine > 0)) out.push("카페인 원료 없음");
    if (hasTag(d, ds.tagDefs, "fiber_src")) out.push("식이섬유 원료");
    if (hasTag(d, ds.tagDefs, "probiotic")) out.push("유산균 원료");
  }
  return out;
}

// 저당 랭킹은 일상적으로 마시는 음료 유형만 (진액·즙·젤리·앰플·샷·원액 등 제외)
const EVERYDAY = new Set(["액상차", "액상커피", "두유", "탄산음료", "과·채음료", "액상음료", "발효음료", "유산균음료"]);
const NOT_EVERYDAY = /진액|즙|젤리|앰플|샷|원액|엑기스|스틱|농축|아르기?닌|글루타치온|알부민/;

// ---- 랭킹 (요구사항 4.3: 비교 단위·산정 기준·동률 처리 공개) ----
export type RankKey = "lowsugar" | "protein" | "plant";
export const RANKINGS: { key: RankKey; label: string; title: string; unit: string; rule: string[] }[] = [
  {
    key: "lowsugar", label: "저당", title: "저당 음료", unit: "100ml 기준",
    rule: ["100ml당 당류 2.5g 미만(저당 기준 충족)인 일상 음료 — 차·커피·두유·탄산·주스·발효·기타 액상음료 유형 (탄산수·진액·즙·젤리·앰플·샷·원액 제외)", "당류 낮은 순 → 동률이면 열량 낮은 순 → 제품명 순", "당류·열량 값이 없는 음료, 100ml 미만 소용량 제외 · 같은 제품의 용량 변형은 하나만"],
  },
  {
    key: "protein", label: "고단백", title: "단백질 많은 음료", unit: "1팩 기준(500ml 이하) / 그 외 100ml",
    rule: ["1팩 단백질 10g 이상 · 100ml당 당류 5g 이하인 음료", "단백질 높은 순 → 동률이면 당류 낮은 순 → 제품명 순", "농축·분말형·입력 오류 추정값, 콜라겐·아미노산 제품, 원재료에 단백 원료가 없는 제품, 50ml 미만 샷형, 값 없는 음료 제외 · 용량 변형은 하나만"],
  },
  {
    key: "plant", label: "식물성", title: "식물성 단백 음료", unit: "1팩 기준(500ml 이하) / 그 외 100ml",
    rule: ["원재료에 식물성 단백 원료(대두·귀리·아몬드 등)가 있고 유제품 원료가 없는 음료", "단백질 높은 순 → 동률이면 당류 낮은 순 → 제품명 순", "원재료 정보가 아직 없는 음료는 판정할 수 없어 제외 · 용량 변형은 하나만"],
  },
];

const byName = (a: Drink, b: Drink) => a.name.localeCompare(b.name, "ko");
export function rank(ds: Dataset, key: RankKey): { list: Drink[]; excluded: number } {
  let excluded = 0;
  const pool: Drink[] = [];
  for (const d of ds.drinks) {
    if (isConcentrate(d) || (d.size !== null && d.size < 50)) { excluded++; continue; } // 50ml 미만 샷·캡슐형은 음료 비교에서 제외
    const s = d.per100.sugar;
    if (key === "lowsugar") {
      if (s === null || d.per100.kcal === null) { excluded++; continue; }
      if (s < LOW_SUGAR && d.per100.kcal >= 5 && EVERYDAY.has(d.type) && !NOT_EVERYDAY.test(d.name) && !(d.size !== null && d.size < 100)) pool.push(d);
    } else if (key === "protein") {
      const p = packProtein(d);
      if (p === null || s === null) { excluded++; continue; }
      if (notProteinComparable(d, ds)) { excluded++; continue; }
      if (p >= PROTEIN_PACK && s <= 5) pool.push(d);
    } else {
      if (!d.hasIngr) { excluded++; continue; }
      if (hasTag(d, ds.tagDefs, "plantprotein") && !hasTag(d, ds.tagDefs, "dairy") && packProtein(d) !== null) pool.push(d);
    }
  }
  const prot = (d: Drink) => packProtein(d) ?? -1;
  if (key === "lowsugar") pool.sort((a, b) => a.per100.sugar! - b.per100.sugar! || a.per100.kcal! - b.per100.kcal! || byName(a, b));
  else pool.sort((a, b) => prot(b) - prot(a) || (a.per100.sugar ?? 99) - (b.per100.sugar ?? 99) || byName(a, b));
  const seen = new Set<string>();
  const list = pool.filter((d) => { const k = baseName(d); if (seen.has(k)) return false; seen.add(k); return true; });
  return { list, excluded };
}

// ---- 샘플러 (요구사항 7: 예시 구성·가격 가설, 판매 전 → 출시 알림) ----
export type Sampler = { slug: string; name: string; desc: string; who: string; category: string; price: number; img: string; items: string[]; rule: string };
// 구성은 운영자가 카테고리 기준 충족 · 원재료 확인 · 1팩 단위 음료 중에서 고른 예시 (관리자 기능 전까지 코드로 관리)
export const SAMPLERS: Sampler[] = [
  {
    slug: "low-sugar", name: "저당 드링크 셀렉션", category: "저당", price: 15900, img: "sugar",
    desc: "100ml당 당류 2.5g 미만 음료를 서로 다른 브랜드·유형으로 5종 골랐어요.", who: "단 음료를 줄이고 싶지만 어떤 맛이 있는지 궁금한 분",
    rule: "100ml당 당류 2.5g 미만 · 서로 다른 브랜드 · 차·커피·식물성·이온음료 등 유형 다양화",
    items: ["P109-801080100-5431", "P109-801080100-2353", "P109-201020000-2911", "P109-801080100-3828", "P109-801080100-1519"],
  },
  {
    slug: "protein", name: "프로틴 테이스팅 키트", category: "단백질", price: 19900, img: "protein",
    desc: "1팩 단백질 20g 안팎, 당류 2g 이하 음료 5종을 브랜드별로 비교해 마셔보세요.", who: "단백질 음료를 박스로 사기 전에 여러 브랜드를 맛보고 싶은 분",
    rule: "1팩 단백질 10g 이상 · 100ml당 당류 5g 이하 · 서로 다른 브랜드 · 유청·닭가슴살·대두 등 원료 다양화",
    items: ["P109-801080100-1548", "P109-801080100-3645", "P109-801080100-5785", "P109-201020000-1167", "P109-500050200-0328"],
  },
  {
    slug: "basic", name: "웰니스 베이직 샘플러", category: "카테고리 혼합", price: 19900, img: "mix",
    desc: "식물성·락토프리·카페인 원료 없는 음료를 고루 섞었어요.", who: "어떤 음료가 맞을지 아직 모르는 분",
    rule: "모두 100ml당 당류 1g 미만 · 식물성 단백, 락토프리 표기, 카페인 원료 없음 카테고리에서 1~2종씩",
    items: ["P109-801080100-3828", "P109-500050200-0127", "P109-801080100-3353", "P109-500050200-0368", "P109-102010200-0663"],
  },
];

export function samplerItems(ds: Dataset, slug: string): Drink[] {
  const s = SAMPLERS.find((x) => x.slug === slug);
  return s ? s.items.map((id) => ds.byId.get(id)).filter((d): d is Drink => !!d) : [];
}
export const samplersWith = (ds: Dataset, id: string) => SAMPLERS.filter((s) => samplerItems(ds, s.slug).some((d) => d.id === id));

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// ---- 픽토그램 (실사 사진 대신, 라인 아이콘) ----
export type PictoKind = "sugar" | "protein" | "plant" | "decaf" | "mix";
export function Picto({ kind }: { kind: string }) {
  const c = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="cd-picto">
      {kind === "sugar" ? (<>
        {/* 각설탕 + 아래 화살표 */}
        <path {...c} d="M14 26l12-6 12 6v14l-12 6-12-6z" /><path {...c} d="M14 26l12 6 12-6M26 32v14" />
        <path {...c} d="M48 18v24M42 36l6 6 6-6" />
      </>) : kind === "protein" ? (<>
        {/* 셰이커 */}
        <path {...c} d="M22 14h20l-2 6H24z" /><path {...c} d="M24 20l2 32h12l2-32" /><path {...c} d="M26 30h12" />
        <path {...c} d="M29 38h6M32 35v6" />
      </>) : kind === "plant" ? (<>
        {/* 잎 */}
        <path {...c} d="M18 46C18 28 30 16 48 16c0 18-12 30-30 30z" /><path {...c} d="M18 46l20-20" /><path {...c} d="M14 50l4-4" />
      </>) : kind === "decaf" ? (<>
        {/* 커피잔 + 사선 */}
        <path {...c} d="M16 26h26v10a12 12 0 0 1-12 12h-2a12 12 0 0 1-12-12z" /><path {...c} d="M42 30h4a5 5 0 0 1 0 10h-5" />
        <path {...c} d="M24 14c-2 3 2 5 0 8M32 14c-2 3 2 5 0 8" /><path {...c} d="M12 52L52 12" />
      </>) : (<>
        {/* 병 세 개 */}
        <path {...c} d="M14 24h10v26H14zM16 18h6v6h-6z" /><path {...c} d="M27 20h10v30H27zM29 14h6v6h-6z" /><path {...c} d="M40 26h10v24H40zM42 20h6v6h-6z" />
      </>)}
    </svg>
  );
}

// ---- 공용 UI (배치는 득근음료와 동일: 헤더 4메뉴 · 업데이트 줄 · 카드 그리드 · 하단 고지) ----
export type NavKey = "find" | "rank" | "sampler" | "about";
export function Shell({ children, active }: { children: React.ReactNode; active?: NavKey }) {
  const nav: [NavKey, string, string][] = [
    ["find", "/chungdam/", "탐색"], ["rank", "/chungdam/ranking/", "랭킹"],
    ["sampler", "/chungdam/samplers/", "샘플러"], ["about", "/chungdam/about/", "방법"],
  ];
  return (
    <div className="cd">
      <header className="cd-hdr">
        <div className="cd-wrap cd-hdr-in">
          <Link href="/chungdam/" className="cd-logo" aria-label="청담음료 홈">청담음료</Link>
          <nav className="cd-nav" aria-label="주요 메뉴">
            {nav.map(([k, href, label]) => <Link key={k} href={href} className={active === k ? "on" : ""}>{label}</Link>)}
          </nav>
        </div>
      </header>
      {children}
      <footer className="cd-ftr">
        <div className="cd-wrap">
          <p>청담음료(가칭) · KAIST MBA 8조 MVP · 데이터 출처: 식품의약품안전처 식품영양성분DB(공공데이터포털), 식품안전나라 품목제조보고(원재료). 표시값은 제품 영양성분표 기준이며 질병의 예방·치료 효과를 의미하지 않습니다. 정렬·랭킹은 공개된 성분 기준에 따른 순서이며 제품 평가가 아닙니다.</p>
          <p><Link href="/chungdam/about/">분석 방법 보기</Link> · <Link href="/chungdam/#signup">출시 알림 받기</Link></p>
        </div>
      </footer>
    </div>
  );
}

export function UpdateStrip({ s }: { s: Summary | null }) {
  return (
    <div className="cd-upd">
      <div className="cd-wrap cd-upd-in">
        <span className="cd-dot" aria-hidden="true" />
        <b>UPDATED {s ? fmtDate(s.collected) : "…"}</b>
        <span>{s ? <>음료 <b>{s.count.toLocaleString("ko-KR")}</b>개 · 신규 <b>+{s.newCount}</b> · 식약처 기준일 {fmtDate(s.baseDate)}</> : "데이터 불러오는 중"}</span>
      </div>
    </div>
  );
}

export function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="cd-stat">
      <span className="cd-stat-l">{label}</span>
      {value === null ? <span className="cd-stat-na">정보 없음</span> : <span className="cd-stat-v"><b>{fmtNum(value)}</b><i>{unit}</i></span>}
    </div>
  );
}

export function DrinkCard({ d, ds, rankNo, from }: { d: Drink; ds: Dataset; rankNo?: number; from?: string }) {
  const b = effectiveBasis(d, "pack");
  const tags = evidenceTags(d, ds).slice(0, 3);
  const ins = insights(d, b).slice(0, 2);
  return (
    <li className="cd-card">
      <Link href={`/chungdam/p/?id=${encodeURIComponent(d.id)}`} className="cd-card-link" onClick={() => ga("product_view", { product_id: d.id, from: from || "list" })}>
        <div className="cd-card-head">
          {rankNo ? <span className="cd-rankno">{rankNo}</span> : null}
          <Pack d={d} className="cd-pack" />
          <div className="cd-card-title">
            <small>{d.maker || "제조사 정보 없음"}{d.isNew ? <em className="cd-new">NEW</em> : null}</small>
            <b>{d.name}</b>
            <span>{fmtSize(d)} · {b === "pack" ? "1팩 기준" : `100${d.basisUnit || "ml"} 기준`} · {d.type}</span>
          </div>
        </div>
        <div className="cd-stats3">
          <Stat label="당류" value={nut(d, "sugar", b)} unit="g" />
          <Stat label="단백질" value={nut(d, "protein", b)} unit="g" />
          <Stat label="열량" value={nut(d, "kcal", b)} unit="kcal" />
        </div>
        {ins.length ? <p className="cd-insight">{ins.join(" · ")}</p> : null}
        {tags.length ? <span className="cd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</span> : null}
      </Link>
    </li>
  );
}
