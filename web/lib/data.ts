// 웹 데이터 로더 — public/data/drinks.min.json (scripts/normalize.py 가 생성)
// 규칙은 docs/CRITERIA.md. 여기서는 표시 계산만 하고 값을 추정하거나 채우지 않는다 (NFR-3).

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export type Shape = "pet" | "can" | "carton" | "pouch";

export type Nutrients = {
  kcal: number | null;
  protein: number | null;
  sugar: number | null;
  carb: number | null;
  fat: number | null;
  satFat: number | null;
  transFat: number | null;
  chol: number | null;
  sodium: number | null;
};

export type Drink = {
  id: string;
  name: string;
  maker: string;
  type: string;
  size: number | null;
  unit: "ml" | "g" | null;
  basisUnit: "ml" | "g" | null;
  single: boolean; // 500ml(g) 이하 + 단위 일치 → 1팩 기준 표시
  per100: Nutrients;
  caffeine: number | null; // 1팩 기준 mg, 제품 표시사항 수동 입력
  created: string | null;
  isNew: boolean;
  image: string | null;
  shape: Shape;
  imported: boolean;
  reportNo: string | null;
  search: string; // 검색용 정규화 문자열
};

export type Summary = {
  collected: string;
  baseDate: string | null;
  rawTotal: number;
  count: number;
  excluded: number;
  singleServe: number;
  newCount: number;
  newRule: "prev" | "created30";
  latestCreated?: string;
  caffeineCount: number;
  imageCount: number;
  byType: Record<string, number>;
};

export type Dataset = {
  summary: Summary;
  types: string[];
  drinks: Drink[];
  byId: Map<string, Drink>;
};

export const NUT_KEYS: (keyof Nutrients)[] = [
  "kcal", "protein", "sugar", "carb", "fat", "satFat", "transFat", "chol", "sodium",
];

export const NUT_LABEL: Record<keyof Nutrients, { label: string; unit: string; sub?: boolean }> = {
  kcal: { label: "열량", unit: "kcal" },
  carb: { label: "탄수화물", unit: "g" },
  sugar: { label: "당류", unit: "g", sub: true },
  protein: { label: "단백질", unit: "g" },
  fat: { label: "지방", unit: "g" },
  satFat: { label: "포화지방", unit: "g", sub: true },
  transFat: { label: "트랜스지방", unit: "g", sub: true },
  chol: { label: "콜레스테롤", unit: "mg" },
  sodium: { label: "나트륨", unit: "mg" },
};

export const normalize = (s: string) => s.toLowerCase().replace(/[\s·()\[\]_\-.,]/g, "");

let cache: Promise<Dataset> | null = null;

export function loadData(): Promise<Dataset> {
  if (!cache) {
    cache = fetch(`${BASE}/data/drinks.min.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`데이터를 불러오지 못했습니다 (${r.status})`);
        return r.json();
      })
      .then((j) => decode(j))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decode(j: any): Dataset {
  const c: Record<string, number> = {};
  (j.cols as string[]).forEach((k, i) => (c[k] = i));
  const makers: string[] = j.makers;
  const types: string[] = j.types;
  const shapes: Shape[] = j.shapes;
  const drinks: Drink[] = (j.rows as unknown[][]).map((r) => {
    const maker = makers[r[c.maker] as number] || "";
    const name = r[c.name] as string;
    return {
      id: r[c.id] as string,
      name,
      maker,
      type: types[r[c.type] as number],
      size: r[c.size] as number | null,
      unit: r[c.unit] as "ml" | "g" | null,
      basisUnit: r[c.basisUnit] as "ml" | "g" | null,
      single: r[c.single] === 1,
      per100: {
        kcal: r[c.kcal] as number | null,
        protein: r[c.protein] as number | null,
        sugar: r[c.sugar] as number | null,
        carb: r[c.carb] as number | null,
        fat: r[c.fat] as number | null,
        satFat: r[c.satFat] as number | null,
        transFat: r[c.transFat] as number | null,
        chol: r[c.chol] as number | null,
        sodium: r[c.sodium] as number | null,
      },
      caffeine: r[c.caffeine] as number | null,
      created: r[c.created] as string | null,
      isNew: r[c.isNew] === 1,
      image: r[c.image] as string | null,
      shape: shapes[r[c.shape] as number] || "pet",
      imported: r[c.importer] === 1,
      reportNo: r[c.reportNo] as string | null,
      search: normalize(`${name} ${maker}`),
    };
  });
  return { summary: j.summary, types, drinks, byId: new Map(drinks.map((d) => [d.id, d])) };
}

export type Basis = "pack" | "100";

/** 표시 기준: 1팩 표시가 가능하면 요청대로, 아니면 100ml(g) */
export function effectiveBasis(d: Drink, want: Basis = "pack"): Basis {
  return want === "pack" && d.single ? "pack" : "100";
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** 영양성분 값 (기준 적용). 값이 없으면 null — 0으로 채우지 않는다. */
export function nut(d: Drink, key: keyof Nutrients, basis: Basis): number | null {
  const v = d.per100[key];
  if (v === null || v === undefined) return null;
  if (basis === "pack" && d.single && d.size) return round1((v * d.size) / 100);
  return v;
}

export function basisLabel(d: Drink, basis: Basis): string {
  if (basis === "pack" && d.single) return `1팩(${fmtSize(d)})`;
  return `100${d.basisUnit || "ml"}`;
}

export function fmtSize(d: Drink): string {
  return d.size ? `${fmtNum(d.size)}${d.unit || ""}` : "용량 정보 없음";
}

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "–";
  if (Number.isInteger(v)) return v.toLocaleString("ko-KR");
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

export function fmtDate(s: string | null | undefined): string {
  return s ? s.replaceAll("-", ".") : "–";
}
