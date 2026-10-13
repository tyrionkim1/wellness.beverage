"use client";
// 내 몸 기준 · 목적 서베이 (docs/CRITERIA.md R9). 로그인 없이 이 기기에만 저장한다.
// ⚠ 하루 필요량 계산식은 추정치 — 이윤표 감수 전. 바꾸면 CRITERIA·CHANGELOG 같이 수정.
import { useCallback, useEffect, useState } from "react";

export type Goal = "muscle" | "weight" | "recovery" | "condition";
export type Sex = "m" | "f";
export type Freq = 0 | 1 | 2 | 3; // 거의 안 함 / 주1–2 / 주3–4 / 주5+
export type Avoid = "dairy" | "caffeine" | "artificial" | "carbonated";

export type Profile = {
  goals: Goal[];
  sex: Sex | null;
  age: number | null;
  height: number | null; // cm
  weight: number | null; // kg
  freq: Freq | null;
  avoid: Avoid[];
  noMajor: boolean; // 대기업 브랜드 빼고 보기
  done: boolean; // 서베이 완료(건너뛰기 포함)
  consent: boolean; // 키·몸무게 저장 동의
};

export const EMPTY_PROFILE: Profile = {
  goals: [], sex: null, age: null, height: null, weight: null, freq: null, avoid: [], noMajor: false, done: false, consent: false,
};

export const GOALS: { id: Goal; label: string; desc: string; icon: string }[] = [
  { id: "muscle", label: "근육 키우기", desc: "단백질 많은 음료", icon: "dumbbell" },
  { id: "weight", label: "체중 관리", desc: "열량·당 낮은 음료", icon: "flame" },
  { id: "recovery", label: "운동 후 보충", desc: "단백질·수분 채우기", icon: "bolt" },
  { id: "condition", label: "컨디션 관리", desc: "유산균·식이섬유 원료", icon: "leaf" },
];

/** 목적 → 실제로 거는 조건 (화면에 그대로 보여줘서 '추천'이 아니라 '필터'임을 드러낸다) */
export const GOAL_RULE: Record<Goal, string> = {
  muscle: "단백질 10g 이상",
  weight: "열량 100kcal 이하 · 당 5g 이하",
  recovery: "단백질 10g 이상 또는 전해질 원료",
  condition: "유산균·식이섬유 원료 또는 식이섬유 3g 이상",
};

export const FREQS: { v: Freq; label: string }[] = [
  { v: 0, label: "거의 안 해요" },
  { v: 1, label: "주 1–2회" },
  { v: 2, label: "주 3–4회" },
  { v: 3, label: "주 5회 이상" },
];

export const AVOIDS: { id: Avoid; label: string }[] = [
  { id: "dairy", label: "유제품" },
  { id: "caffeine", label: "카페인" },
  { id: "artificial", label: "인공감미료" },
  { id: "carbonated", label: "탄산" },
];

// ---- 하루 필요량 (추정) ----
const PROTEIN_PER_KG = [0.9, 1.2, 1.4, 1.6]; // 운동 빈도별 g/kg
const ACTIVITY = [1.2, 1.375, 1.55, 1.725]; // 활동계수
const DEFAULT_BODY = { m: { age: 35, height: 173, weight: 72 }, f: { age: 35, height: 160, weight: 57 } };

export type Targets = {
  protein: number; // g
  kcal: number;
  fiber: number; // g
  sugarMax: number; // g
  caffeineMax: number; // mg
  proteinPerKg: number;
  weight: number;
  usedDefaults: boolean; // 몸 정보 없이 평균값으로 계산했는지
};

export function targets(p: Profile): Targets {
  const sex: Sex = p.sex || "m";
  const d = DEFAULT_BODY[sex];
  const usedDefaults = !(p.weight && p.height && p.age);
  const weight = p.weight || (p.sex ? d.weight : 65);
  const height = p.height || (p.sex ? d.height : 167);
  const age = p.age || d.age;
  const freq: Freq = p.freq ?? 1;
  const perKg = Math.min(2.0, PROTEIN_PER_KG[freq] + (p.goals.includes("muscle") ? 0.2 : 0));
  // Mifflin-St Jeor. 성별 미입력이면 남녀 상수의 중간값
  const sexConst = p.sex === "m" ? 5 : p.sex === "f" ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexConst;
  const kcal = Math.round((bmr * ACTIVITY[freq]) / 10) * 10;
  return {
    protein: Math.round(weight * perKg),
    kcal,
    fiber: Math.round((kcal / 1000) * 12),
    sugarMax: Math.round((kcal * 0.1) / 4),
    caffeineMax: 400,
    proteinPerKg: Math.round(perKg * 10) / 10,
    weight,
    usedDefaults,
  };
}

/** 한 병이 내 하루의 몇 %인지 (정수, 0이면 0) */
export function shareOf(v: number | null, target: number): number | null {
  if (v === null || !target) return null;
  return Math.round((v / target) * 100);
}

export const EGG_PROTEIN_G = 6; // 삶은 달걀 1개(50g) 단백질 근사 — ⚠ 추정, 이해 보조용
export function eggs(proteinG: number | null): string | null {
  if (proteinG === null || proteinG < 3) return null;
  const n = Math.round((proteinG / EGG_PROTEIN_G) * 2) / 2; // 0.5개 단위
  const whole = Math.floor(n);
  return n % 1 ? (whole ? `약 ${whole}개 반` : "약 반 개") : `약 ${whole}개`;
}

// ---- 저장 (이 기기만) ----
const KEY = "dg.profile.v1";
const listeners = new Set<(p: Profile) => void>();
let mem: Profile | null = null;

function read(): Profile {
  if (mem) return mem;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    mem = v && typeof v === "object" ? { ...EMPTY_PROFILE, ...v } : { ...EMPTY_PROFILE };
  } catch {
    mem = { ...EMPTY_PROFILE };
  }
  return mem!;
}

function write(p: Profile) {
  mem = p;
  try {
    // 동의하지 않았으면 키·몸무게·나이는 저장하지 않고 메모리에만 둔다
    const save = p.consent ? p : { ...p, age: null, height: null, weight: null };
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* 저장 불가 환경 */
  }
  listeners.forEach((l) => l(p));
}

export function useProfile() {
  const [p, setP] = useState<Profile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setP(read());
    setReady(true);
    const l = (v: Profile) => setP(v);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const update = useCallback((patch: Partial<Profile>) => write({ ...read(), ...patch }), []);
  const reset = useCallback(() => write({ ...EMPTY_PROFILE }), []);
  return { profile: p, ready, update, reset };
}
