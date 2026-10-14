"use client";
// 청담음료 공용 — 헤더/푸터, 제품 카드, 판정 규칙, 랭킹·샘플러 정의.
// 원칙(요구사항 2.3·4.2·4.3): 수치 없음 ≠ 0, 기준 공개, 효능 단정 금지, 근거 있는 태그만.
import Link from "next/link";
import Pack from "@/components/Pack";
import { Dataset, Drink, TagDef, effectiveBasis, fmtNum, fmtSize, hasTag, nut } from "@/lib/data";
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

// ---- 랭킹 (요구사항 4.3: 비교 단위·산정 기준·동률 처리 공개) ----
export type RankKey = "lowsugar" | "protein" | "plant";
export const RANKINGS: { key: RankKey; label: string; title: string; unit: string; rule: string[] }[] = [
  {
    key: "lowsugar", label: "저당", title: "저당 음료", unit: "100ml 기준",
    rule: ["100ml당 당류 2.5g 미만(저당 기준 충족)이면서 열량이 있는 음료 (탄산수·생수류 제외)", "당류 낮은 순 → 동률이면 열량 낮은 순 → 제품명 순", "당류·열량 값이 없는 음료, 50ml 미만 샷·캡슐형 제외 · 같은 제품의 용량 변형은 하나만"],
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
      if (s < LOW_SUGAR && d.per100.kcal >= 5 && d.type !== "탄산수") pool.push(d);
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
    slug: "low-sugar", name: "저당 드링크 셀렉션", category: "저당", price: 15900, img: "photo-1667857410842-ce0a0069acb1",
    desc: "100ml당 당류 2.5g 미만 음료를 서로 다른 브랜드·유형으로 5종 골랐어요.", who: "단 음료를 줄이고 싶지만 어떤 맛이 있는지 궁금한 분",
    rule: "100ml당 당류 2.5g 미만 · 서로 다른 브랜드 · 차·커피·식물성·이온음료 등 유형 다양화",
    items: ["P109-801080100-5431", "P109-801080100-2353", "P109-201020000-2911", "P109-801080100-3828", "P109-801080100-1519"],
  },
  {
    slug: "protein", name: "프로틴 테이스팅 키트", category: "단백질", price: 19900, img: "photo-1596633605700-1efc9b49e277",
    desc: "1팩 단백질 20g 안팎, 당류 2g 이하 음료 5종을 브랜드별로 비교해 마셔보세요.", who: "단백질 음료를 박스로 사기 전에 여러 브랜드를 맛보고 싶은 분",
    rule: "1팩 단백질 10g 이상 · 100ml당 당류 5g 이하 · 서로 다른 브랜드 · 유청·닭가슴살·대두 등 원료 다양화",
    items: ["P109-801080100-1548", "P109-801080100-3645", "P109-801080100-5785", "P109-201020000-1167", "P109-500050200-0328"],
  },
  {
    slug: "basic", name: "웰니스 베이직 샘플러", category: "카테고리 혼합", price: 19900, img: "photo-1615485737457-f07082c77813",
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

export const img = (id: string, w = 640) => `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;
export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// ---- 공용 UI ----
export function Shell({ children, active }: { children: React.ReactNode; active?: "find" | "rank" | "sampler" }) {
  return (
    <div className="cd">
      <header className="cd-hdr">
        <div className="cd-wrap cd-hdr-in">
          <Link href="/chungdam/" className="cd-logo">청담음료</Link>
          <nav className="cd-nav" aria-label="주요 메뉴">
            <Link href="/chungdam/#finder" className={active === "find" ? "on" : ""}>음료 찾기</Link>
            <Link href="/chungdam/ranking/" className={active === "rank" ? "on" : ""}>랭킹</Link>
            <Link href="/chungdam/samplers/" className={active === "sampler" ? "on" : ""}>샘플러</Link>
            <Link href="/chungdam/#signup" className="cd-nav-cta">출시 알림</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="cd-ftr">
        <div className="cd-wrap">
          <p><b>청담음료(가칭)</b> · KAIST MBA 8조 MVP</p>
          <p>데이터 출처: 식품의약품안전처 식품영양성분DB(공공데이터포털), 식품안전나라 품목제조보고(원재료). 표시값은 제품 영양성분표 기준이며 질병의 예방·치료 효과를 의미하지 않습니다. 정렬·랭킹은 공개된 성분 기준에 따른 순서이며 제품 평가가 아닙니다.</p>
        </div>
      </footer>
    </div>
  );
}

export function DrinkCard({ d, ds, rankNo, from }: { d: Drink; ds: Dataset; rankNo?: number; from?: string }) {
  const b = effectiveBasis(d, "pack");
  const tags = evidenceTags(d, ds).slice(0, 3);
  const v = (k: "sugar" | "protein" | "kcal") => nut(d, k, b);
  const val = (x: number | null, u: string) => (x === null ? "정보 없음" : `${fmtNum(x)}${u}`);
  return (
    <li className="cd-item">
      <Link href={`/chungdam/p/?id=${encodeURIComponent(d.id)}`} onClick={() => ga("product_view", { product_id: d.id, from: from || "list" })}>
        {rankNo ? <span className="cd-rankno">{rankNo}</span> : null}
        <Pack d={d} className="cd-pack" />
        <span className="cd-info">
          <small>{d.maker || "제조사 정보 없음"}</small>
          <b>{d.name}</b>
          <em>{fmtSize(d)} · {b === "pack" ? "1팩 기준" : `100${d.basisUnit || "ml"} 기준`}</em>
          <span className="cd-nums">
            <span>당류 <i>{val(v("sugar"), "g")}</i></span>
            <span>단백질 <i>{val(v("protein"), "g")}</i></span>
            <span>열량 <i>{val(v("kcal"), "kcal")}</i></span>
          </span>
          {tags.length ? <span className="cd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</span> : null}
        </span>
      </Link>
    </li>
  );
}
