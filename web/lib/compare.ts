"use client";
// 비교 담기 상태 — 브라우저 저장소(편의 기능). 실패해도 화면은 동작해야 한다.
import { useEffect, useState, useCallback } from "react";

const KEY = "cd.compare.v1";
export const MAX_COMPARE = 4;
type Listener = (ids: string[]) => void;
const listeners = new Set<Listener>();
let mem: string[] | null = null;

function read(): string[] {
  if (mem) return mem;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    mem = Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    mem = [];
  }
  return mem;
}

function write(ids: string[]) {
  mem = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* 저장 불가 환경 — 메모리로만 유지 */
  }
  listeners.forEach((l) => l(ids));
}

export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    const l: Listener = (v) => setIds(v);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const toggle = useCallback((id: string): "added" | "removed" | "full" => {
    const cur = read();
    if (cur.includes(id)) {
      write(cur.filter((x) => x !== id));
      return "removed";
    }
    if (cur.length >= MAX_COMPARE) return "full";
    write([...cur, id]);
    return "added";
  }, []);
  const clear = useCallback(() => write([]), []);
  const set = useCallback((v: string[]) => write(v.slice(0, MAX_COMPARE)), []);
  return { ids, toggle, clear, set };
}
