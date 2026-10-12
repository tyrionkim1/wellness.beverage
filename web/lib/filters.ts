// 필터 정의 — docs/CRITERIA.md 와 동일하게 유지. 바꾸면 CHANGELOG 기록.
import { Drink, effectiveBasis, nut, normalize } from "./data";

export type Filters = {
  q: string;
  protein: number | null; // 이상 (g)
  sugar: number | null; // 이하 (g)
  caffeine: "" | "none" | "low" | "high"; // 0mg / 1~50mg / 50mg 초과
  types: string[];
  bulk: boolean; // 500ml 초과 대용량 포함 여부
  sort: "recent" | "name";
};

export const EMPTY: Filters = { q: "", protein: null, sugar: null, caffeine: "", types: [], bulk: true, sort: "recent" };

export const PROTEIN_OPTS = [10, 15, 20, 25];
export const SUGAR_OPTS = [0, 2, 5];
export const CAFFEINE_OPTS: { v: Filters["caffeine"]; label: string }[] = [
  { v: "none", label: "0mg" },
  { v: "low", label: "50mg 이하" },
  { v: "high", label: "50mg 초과" },
];

// FR-6 프리셋 = 필터 조합의 바로가기. 추천·등급이 아니다. 이름은 숫자로만.
export const PRESETS: { id: string; label: string; f: Partial<Filters> }[] = [
  { id: "p10s0", label: "단백질 10g↑ · 당류 0g", f: { protein: 10, sugar: 0 } },
  { id: "p20", label: "단백질 20g↑", f: { protein: 20 } },
  { id: "fizz0", label: "탄산 · 당류 0g", f: { sugar: 0, types: ["탄산음료", "탄산수"] } },
  { id: "soy10", label: "두유 · 단백질 10g↑", f: { protein: 10, types: ["두유"] } },
  { id: "caf", label: "카페인 50mg 초과", f: { caffeine: "high" } },
];

export function applyPreset(f: Partial<Filters>): Filters {
  return { ...EMPTY, ...f };
}

export function presetActive(cur: Filters, p: Partial<Filters>): boolean {
  const t = applyPreset(p);
  return (
    cur.protein === t.protein && cur.sugar === t.sugar && cur.caffeine === t.caffeine &&
    cur.types.slice().sort().join() === t.types.slice().sort().join()
  );
}

export type FilterResult = { items: Drink[]; excludedNoInfo: number };

export function run(drinks: Drink[], f: Filters): FilterResult {
  const q = normalize(f.q);
  const typeSet = f.types.length ? new Set(f.types) : null;
  let excludedNoInfo = 0;
  const out: Drink[] = [];
  for (const d of drinks) {
    if (!f.bulk && !d.single) continue;
    if (typeSet && !typeSet.has(d.type)) continue;
    if (q && !d.search.includes(q)) continue;
    const b = effectiveBasis(d, "pack");
    if (f.protein !== null) {
      const v = nut(d, "protein", b);
      if (v === null) { excludedNoInfo++; continue; }
      if (v < f.protein) continue;
    }
    if (f.sugar !== null) {
      const v = nut(d, "sugar", b);
      if (v === null) { excludedNoInfo++; continue; }
      if (v > f.sugar) continue;
    }
    if (f.caffeine) {
      const v = d.caffeine;
      if (v === null) { excludedNoInfo++; continue; }
      if (f.caffeine === "none" && v !== 0) continue;
      if (f.caffeine === "low" && !(v > 0 && v <= 50)) continue;
      if (f.caffeine === "high" && !(v > 50)) continue;
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
  if (f.caffeine) p.set("c", f.caffeine);
  if (f.types.length) p.set("t", f.types.join(","));
  if (!f.bulk) p.set("bulk", "0");
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
  const c = sp.get("c");
  return {
    q: sp.get("q") || "",
    protein: n("p"),
    sugar: n("s"),
    caffeine: c === "none" || c === "low" || c === "high" ? c : "",
    types: (sp.get("t") || "").split(",").filter(Boolean),
    bulk: sp.get("bulk") !== "0",
    sort: sp.get("sort") === "name" ? "name" : "recent",
  };
}
