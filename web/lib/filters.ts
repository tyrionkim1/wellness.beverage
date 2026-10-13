// 필터 정의 — docs/CRITERIA.md 와 동일하게 유지. 바꾸면 CHANGELOG 기록.
import { Drink, effectiveBasis, nut, normalize, TagDef } from "./data";

export type Filters = {
  q: string;
  protein: number | null; // 이상 (g)
  sugar: number | null; // 이하 (g)
  kcal: number | null; // 이하 (kcal)
  fiber: number | null; // 이상 (g)
  caffeine: "" | "none" | "low" | "high"; // 0mg / 1~50mg / 50mg 초과 (표시사항 입력분)
  feats: string[]; // 원재료 '포함' 태그
  excl: string[]; // 원재료 '없음' 조건
  sweet: string[]; // 감미료 포함 (하나라도)
  types: string[];
  bulk: boolean; // 500ml 초과 대용량 포함 여부
  goals: string[]; // 목적 서베이(R9) — 하나라도 맞으면 통과
  noMajor: boolean; // 대기업 브랜드 빼기 (major.csv 키워드 판별)
  sort: "recent" | "name";
};

export const EMPTY: Filters = {
  q: "", protein: null, sugar: null, kcal: null, fiber: null, caffeine: "",
  feats: [], excl: [], sweet: [], types: [], bulk: true, goals: [], noMajor: false, sort: "recent",
};

export const PROTEIN_OPTS = [10, 15, 20, 25];
export const SUGAR_OPTS = [0, 2, 5];
export const KCAL_OPTS = [10, 50, 100, 150];
export const FIBER_OPTS = [1, 3, 5];
export const CAFFEINE_OPTS: { v: Filters["caffeine"]; label: string }[] = [
  { v: "none", label: "0mg" },
  { v: "low", label: "50mg 이하" },
  { v: "high", label: "50mg 초과" },
];

// 원재료 '포함' 필터 (원재료명 기준 사실 태그)
export const FEATURE_OPTS: { id: string; label: string }[] = [
  { id: "lactofree", label: "락토프리 표기" },
  { id: "probiotic", label: "유산균 원료" },
  { id: "plantprotein", label: "식물성 단백" },
  { id: "animalprotein", label: "유청·동물성 단백" },
  { id: "fiber_src", label: "식이섬유 원료" },
  { id: "amino", label: "아미노산 원료" },
  { id: "electrolyte", label: "전해질 원료" },
  { id: "carbonated", label: "탄산" },
  { id: "collagen", label: "콜라겐" },
];
// '없음' 필터 — 원재료명이 확보된 제품에서만 판정
export const EXCLUDE_OPTS: { id: string; label: string; kind: "tag" | "sweet" }[] = [
  { id: "dairy", label: "유제품 원료 없음", kind: "tag" },
  { id: "animal", label: "동물성 원료 없음", kind: "tag" },
  { id: "caffeine_src", label: "카페인 원료 없음", kind: "tag" },
  { id: "sugar", label: "설탕·당류 원료 없음", kind: "sweet" },
  { id: "artificial", label: "인공감미료 없음", kind: "sweet" },
  { id: "carbonated", label: "탄산 없음", kind: "tag" },
];
const ARTIFICIAL = ["sucralose", "acek", "aspartame"];
export const SWEET_OPTS: { id: string; label: string }[] = [
  { id: "allulose", label: "알룰로스" },
  { id: "erythritol", label: "에리스리톨" },
  { id: "stevia", label: "스테비아" },
  { id: "sucralose", label: "수크랄로스" },
  { id: "acek", label: "아세설팜칼륨" },
  { id: "aspartame", label: "아스파탐" },
  { id: "sugaralcohol", label: "말티톨·자일리톨" },
  { id: "monkfruit", label: "나한과" },
];

// FR-6 프리셋 = 필터 조합의 바로가기. 추천·등급이 아니다. 이름은 숫자·원료명으로만.
export const PRESETS: { id: string; label: string; f: Partial<Filters> }[] = [
  { id: "p10s0", label: "단백질 10g↑ · 당류 0g", f: { protein: 10, sugar: 0 } },
  { id: "p20", label: "단백질 20g↑", f: { protein: 20 } },
  { id: "k10", label: "열량 10kcal↓ · 당류 0g", f: { kcal: 10, sugar: 0 } },
  { id: "plant10", label: "식물성 단백 · 10g↑", f: { protein: 10, feats: ["plantprotein"] } },
  { id: "nodairy", label: "유제품 원료 없음 · 단백질 10g↑", f: { protein: 10, excl: ["dairy"] } },
  { id: "pro", label: "유산균 원료 · 당류 5g↓", f: { feats: ["probiotic"], sugar: 5 } },
  { id: "allu", label: "알룰로스 · 당류 0g", f: { sweet: ["allulose"], sugar: 0 } },
];

export function applyPreset(f: Partial<Filters>): Filters {
  return { ...EMPTY, ...f };
}

const same = (a: string[], b: string[]) => a.slice().sort().join() === b.slice().sort().join();
export function presetActive(cur: Filters, p: Partial<Filters>): boolean {
  const t = applyPreset(p);
  return (
    cur.protein === t.protein && cur.sugar === t.sugar && cur.kcal === t.kcal && cur.fiber === t.fiber &&
    cur.caffeine === t.caffeine && same(cur.types, t.types) && same(cur.feats, t.feats) &&
    same(cur.excl, t.excl) && same(cur.sweet, t.sweet) && same(cur.goals, t.goals) && cur.noMajor === t.noMajor
  );
}

export function activeCount(f: Filters): number {
  return [f.protein, f.sugar, f.kcal, f.fiber].filter((v) => v !== null).length +
    (f.caffeine ? 1 : 0) + f.feats.length + f.excl.length + f.sweet.length + f.types.length + (f.bulk ? 0 : 1) +
    f.goals.length + (f.noMajor ? 1 : 0);
}

export type FilterResult = { items: Drink[]; excludedNoInfo: number };

export function run(drinks: Drink[], f: Filters, tagDefs: TagDef[], sweetDefs: TagDef[]): FilterResult {
  const q = normalize(f.q);
  const typeSet = f.types.length ? new Set(f.types) : null;
  const bit = (defs: TagDef[], id: string) => {
    const i = defs.findIndex(([t]) => t === id);
    return i < 0 ? 0 : 1 << i;
  };
  const featMask = f.feats.reduce((m, id) => m | bit(tagDefs, id), 0);
  const sweetAny = f.sweet.reduce((m, id) => m | bit(sweetDefs, id), 0);
  const ANIMAL = bit(tagDefs, "dairy") | bit(tagDefs, "animalprotein") | bit(tagDefs, "collagen");
  const exTag = f.excl.reduce((m, id) => {
    if (id === "animal") return m | ANIMAL;
    const o = EXCLUDE_OPTS.find((x) => x.id === id);
    return o?.kind === "tag" ? m | bit(tagDefs, id) : m;
  }, 0);
  const exSweet = f.excl.reduce((m, id) => {
    if (id === "artificial") return ARTIFICIAL.reduce((mm, a) => mm | bit(sweetDefs, a), m);
    const o = EXCLUDE_OPTS.find((x) => x.id === id);
    return o?.kind === "sweet" ? m | bit(sweetDefs, id) : m;
  }, 0);
  const exFizzType = f.excl.includes("carbonated");
  const ELECTRO = bit(tagDefs, "electrolyte");
  const COND = bit(tagDefs, "probiotic") | bit(tagDefs, "fiber_src");
  const goalSet = new Set(f.goals);
  const needIngr = featMask !== 0 || sweetAny !== 0 || exTag !== 0 || exSweet !== 0;
  const lactoOnly = f.feats.length === 1 && f.feats[0] === "lactofree"; // 이름 태그는 원재료 없이도 판정 가능

  let excludedNoInfo = 0;
  const out: Drink[] = [];
  for (const d of drinks) {
    if (!f.bulk && !d.single) continue;
    if (typeSet && !typeSet.has(d.type)) continue;
    if (q && !d.search.includes(q)) continue;
    if (f.noMajor && d.major) continue;
    if (exFizzType && (d.type === "탄산음료" || d.type === "탄산수")) continue;
    const b = effectiveBasis(d, "pack");
    const checkMin = (v: number | null, min: number | null) => min === null || (v !== null && v >= min);
    const checkMax = (v: number | null, max: number | null) => max === null || (v !== null && v <= max);
    const vals = { p: nut(d, "protein", b), s: nut(d, "sugar", b), k: nut(d, "kcal", b), fb: nut(d, "fiber", b) };
    if ((f.protein !== null && vals.p === null) || (f.sugar !== null && vals.s === null) ||
        (f.kcal !== null && vals.k === null) || (f.fiber !== null && vals.fb === null)) { excludedNoInfo++; continue; }
    if (!checkMin(vals.p, f.protein) || !checkMax(vals.s, f.sugar) || !checkMax(vals.k, f.kcal) || !checkMin(vals.fb, f.fiber)) continue;
    if (f.caffeine) {
      const v = d.caffeine;
      if (v === null) { excludedNoInfo++; continue; }
      if (f.caffeine === "none" && v !== 0) continue;
      if (f.caffeine === "low" && !(v > 0 && v <= 50)) continue;
      if (f.caffeine === "high" && !(v > 50)) continue;
    }
    if (goalSet.size) {
      const p = vals.p ?? -1, k = vals.k, s = vals.s, fb = vals.fb ?? -1;
      const ok =
        (goalSet.has("muscle") && p >= 10) ||
        (goalSet.has("weight") && k !== null && k <= 100 && s !== null && s <= 5) ||
        (goalSet.has("recovery") && (p >= 10 || (d.tags & ELECTRO) !== 0)) ||
        (goalSet.has("condition") && ((d.tags & COND) !== 0 || fb >= 3));
      if (!ok) continue;
    }
    if (needIngr) {
      if (!d.hasIngr && !lactoOnly) { excludedNoInfo++; continue; }
      if ((d.tags & featMask) !== featMask) continue;
      if (sweetAny && (d.sweet & sweetAny) === 0) continue;
      if (d.tags & exTag) continue;
      if (d.sweet & exSweet) continue;
    }
    out.push(d);
  }
  if (f.sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  else out.sort((a, b) => (b.created || "").localeCompare(a.created || "") || a.name.localeCompare(b.name, "ko"));
  return { items: out, excludedNoInfo };
}

// URL <-> 필터 (FR-10 공유, 새로고침 유지)
export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.protein !== null) p.set("p", String(f.protein));
  if (f.sugar !== null) p.set("s", String(f.sugar));
  if (f.kcal !== null) p.set("k", String(f.kcal));
  if (f.fiber !== null) p.set("fb", String(f.fiber));
  if (f.caffeine) p.set("c", f.caffeine);
  if (f.feats.length) p.set("f", f.feats.join(","));
  if (f.excl.length) p.set("x", f.excl.join(","));
  if (f.sweet.length) p.set("sw", f.sweet.join(","));
  if (f.types.length) p.set("t", f.types.join(","));
  if (!f.bulk) p.set("bulk", "0");
  if (f.goals.length) p.set("g", f.goals.join(","));
  if (f.noMajor) p.set("nm", "1");
  if (f.sort !== "recent") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function fromQuery(sp: URLSearchParams): Filters {
  const n = (k: string) => {
    const v = sp.get(k);
    if (v === null || v === "") return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const list = (k: string) => (sp.get(k) || "").split(",").filter(Boolean);
  const c = sp.get("c");
  return {
    q: sp.get("q") || "",
    protein: n("p"), sugar: n("s"), kcal: n("k"), fiber: n("fb"),
    caffeine: c === "none" || c === "low" || c === "high" ? c : "",
    feats: list("f"), excl: list("x"), sweet: list("sw"), types: list("t"),
    bulk: sp.get("bulk") !== "0",
    goals: list("g"), noMajor: sp.get("nm") === "1",
    sort: sp.get("sort") === "name" ? "name" : "recent",
  };
}
