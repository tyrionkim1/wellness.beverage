"use client";
// 카드에 보여줄 숫자 3칸 — 사용자가 고른다 (브라우저 저장, 실패 시 기본값)
import { useCallback, useEffect, useState } from "react";

export type SlotKey = "protein" | "sugar" | "kcal" | "caffeine" | "sodium" | "carb" | "fat" | "fiber" | "proteinShare";

export const SLOT_OPTIONS: { key: SlotKey; label: string; unit: string }[] = [
  { key: "protein", label: "단백질", unit: "g" },
  { key: "sugar", label: "당류", unit: "g" },
  { key: "kcal", label: "열량", unit: "kcal" },
  { key: "proteinShare", label: "단백질 비중", unit: "%" },
  { key: "caffeine", label: "카페인", unit: "mg" },
  { key: "sodium", label: "나트륨", unit: "mg" },
  { key: "carb", label: "탄수화물", unit: "g" },
  { key: "fat", label: "지방", unit: "g" },
  { key: "fiber", label: "식이섬유", unit: "g" },
];

export const DEFAULT_SLOTS: SlotKey[] = ["protein", "sugar", "kcal"];
const KEY = "dg.slots.v1";
const listeners = new Set<(s: SlotKey[]) => void>();

function read(): SlotKey[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(v) && v.length === 3 && v.every((k) => SLOT_OPTIONS.some((o) => o.key === k))) return v;
  } catch {
    /* noop */
  }
  return DEFAULT_SLOTS;
}

export function useSlots() {
  const [slots, setSlots] = useState<SlotKey[]>(DEFAULT_SLOTS);
  useEffect(() => {
    setSlots(read());
    const l = (s: SlotKey[]) => setSlots(s);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const save = useCallback((s: SlotKey[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* noop */
    }
    listeners.forEach((l) => l(s));
  }, []);
  return { slots, save };
}
