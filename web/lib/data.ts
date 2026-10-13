// 웹 데이터 로더 — public/data/drinks.min.json (scripts/normalize.py 가 생성)
// 규칙은 docs/CRITERIA.md. 여기서는 표시 계산만 하고 값을 추정하거나 채우지 않는다 (NFR-3).

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export type Shape = "pet" | "can" | "carton" | "pouch";

export type Nutrients = {
  fiber: number | null;
  potassium: number | null;
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
  tags: number; // 원재료 기반 태그 비트 (tagDefs 순서)
  sweet: number; // 감미료 비트 (sweetDefs 순서)
  hasIngr: boolean; // 원재료명 확보 여부
  taste: Taste | null;
  major: string | null; // 대기업 브랜드 그룹명 (data/brands/major.csv, 키워드 판별 — 오판 가능)
  search: string; // 검색용 정규화 문자열
};

/** 팀 시음 패널 기록: [기준음료 대비 문장, [단맛,산미,탄산,바디감,뒷맛] 1~3 (0=미기록), 패널 수, 시음일, 메모] */
export type Taste = [string, number[], number, string, string];
export type TagDef = [string, string];

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
  ingredientCount?: number;
  tasteCount?: number;
  fiberCount?: number;
  majorCount?: number;
};

export type Dataset = {
  summary: Summary;
  types: string[];
  tagDefs: TagDef[];
  sweetDefs: TagDef[];
  majorGroups: string[];
  drinks: Drink[];
  byId: Map<string, Drink>;
};

export const NUT_KEYS: (keyof Nutrients)[] = [
  "kcal", "protein", "sugar", "carb", "fat", "satFat", "transFat", "chol", "sodium", "fiber", "potassium",
];

/** 1일 영양성분 기준치 (식품 등의 표시기준). ⚠ 수치는 이윤표 감수 시 재확인 */
export const DAILY_VALUE: Partial<Record<keyof Nutrients, number>> = {
  carb: 324, sugar: 100, fiber: 25, protein: 55, fat: 54, satFat: 15, chol: 300, sodium: 2000, potassium: 3500,
};
export const CAFFEINE_DAILY_MAX = 400; // 성인 1일 카페인 최대 섭취권고량(mg), 식약처
export const SUGAR_CUBE_G = 3; // 각설탕 1개 환산 기준(g) ⚠ 확인 필요

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
  fiber: { label: "식이섬유", unit: "g", sub: true },
  potassium: { label: "칼륨", unit: "mg" },
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
  const has = (k: string) => k in c;
  const majorGroups: string[] = j.majorGroups || [];
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
        fiber: has("fiber") ? (r[c.fiber] as number | null) : null,
        potassium: has("potassium") ? (r[c.potassium] as number | null) : null,
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
      tags: has("tags") ? (r[c.tags] as number) || 0 : 0,
      sweet: has("sweet") ? (r[c.sweet] as number) || 0 : 0,
      hasIngr: has("hasIngr") ? r[c.hasIngr] === 1 : false,
      taste: has("taste") ? (r[c.taste] as Taste | null) : null,
      major: has("major") && (r[c.major] as number) >= 0 ? majorGroups[r[c.major] as number] || null : null,
      search: normalize(`${name} ${maker}`),
    };
  });
  return {
    summary: j.summary, types, tagDefs: j.tagDefs || [], sweetDefs: j.sweetDefs || [], majorGroups,
    drinks, byId: new Map(drinks.map((d) => [d.id, d])),
  };
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

// ---- 직관 표현 (숫자에서만 계산, 평가·순위 아님) ----

/** 열량 중 단백질에서 오는 비율(%) = 단백질 g × 4 kcal ÷ 열량 */
export function proteinShare(d: Drink): number | null {
  const p = d.per100.protein, k = d.per100.kcal;
  if (p === null || k === null || k <= 0 || p <= 0) return null;
  return Math.min(100, Math.round(((p * 4) / k) * 100));
}

export function dvPercent(key: keyof Nutrients, value: number | null): number | null {
  const dv = DAILY_VALUE[key];
  if (!dv || value === null) return null;
  return Math.round((value / dv) * 100);
}

export function sugarCubes(sugarG: number | null): number | null {
  if (sugarG === null) return null;
  return Math.round((sugarG / SUGAR_CUBE_G) * 2) / 2; // 0.5개 단위
}

/** 카드 한 줄 요약 — 최대 3개 문장 조각 */
export function insights(d: Drink, b: Basis): string[] {
  const out: string[] = [];
  const share = proteinShare(d);
  if (share !== null && share >= 30) out.push(`열량의 ${share}%가 단백질`);
  const s = nut(d, "sugar", b);
  const cubes = sugarCubes(s);
  if (cubes !== null) out.push(cubes === 0 ? "당류 0g" : `각설탕 ${fmtNum(cubes)}개`);
  const na = dvPercent("sodium", nut(d, "sodium", b));
  if (na !== null && na >= 10) out.push(`나트륨 하루치 ${na}%`);
  if (d.caffeine !== null) out.push(`카페인 하루 권고량 ${Math.round((d.caffeine / CAFFEINE_DAILY_MAX) * 100)}%`);
  return out.slice(0, 3);
}

export function tagNames(d: Drink, defs: TagDef[]): string[] {
  return defs.filter((_, i) => d.tags & (1 << i)).map(([, n]) => n);
}
export function sweetNames(d: Drink, defs: TagDef[]): string[] {
  return defs.filter((_, i) => d.sweet & (1 << i)).map(([, n]) => n);
}
export function hasTag(d: Drink, defs: TagDef[], id: string): boolean {
  const i = defs.findIndex(([t]) => t === id);
  return i >= 0 && (d.tags & (1 << i)) !== 0;
}

// 원재료명 전문 (샤드 파일, 상세 화면에서만 로드)
const ingrCache = new Map<string, Promise<Record<string, [string, string]>>>();
async function md5prefix(s: string): Promise<string> {
  // normalize.py 와 같은 규칙: md5(id) 앞 2자리. 브라우저엔 md5가 없어 소형 구현 사용
  return md5(s).slice(0, 2);
}
export async function loadIngredients(id: string): Promise<[string, string] | null> {
  const h = await md5prefix(id);
  if (!ingrCache.has(h)) {
    ingrCache.set(h, fetch(`${BASE}/data/ingr/${h}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  }
  const m = await ingrCache.get(h)!;
  return m[id] || null;
}

// 최소 MD5 (공개 도메인 알고리즘, 짧은 문자열용)
function md5(str: string): string {
  const utf8 = unescape(encodeURIComponent(str));
  const n = utf8.length;
  const words: number[] = [];
  for (let i = 0; i < n; i++) words[i >> 2] |= utf8.charCodeAt(i) << ((i % 4) * 8);
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  words[(((n + 8) >> 6) + 1) * 16 - 2] = n * 8;
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  for (let off = 0; off < words.length; off += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const tmp = D; D = C; C = B;
      const x = (A + F + K[i] + (words[off + g] | 0)) | 0;
      const sh = S[(i >> 4) * 4 + (i % 4)];
      B = (B + ((x << sh) | (x >>> (32 - sh)))) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  return [a0, b0, c0, d0].map((v) => Array.from({ length: 4 }, (_, i) => ((v >>> (i * 8)) & 255).toString(16).padStart(2, "0")).join("")).join("");
}
