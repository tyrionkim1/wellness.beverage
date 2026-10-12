"use client";
// 비교함 · 샘플러 담기 상태 — 브라우저 저장소(편의 기능). 실패해도 화면은 동작해야 한다.
import { useCallback, useEffect, useState } from "react";

type Listener = (ids: string[]) => void;

function makeStore(key: string, max: number) {
  const listeners = new Set<Listener>();
  let mem: string[] | null = null;
  const read = (): string[] => {
    if (mem) return mem;
    try {
      const v = JSON.parse(localStorage.getItem(key) || "[]");
      mem = Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, max) : [];
    } catch {
      mem = [];
    }
    return mem;
  };
  const write = (ids: string[]) => {
    mem = ids;
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      /* 저장 불가 환경 — 메모리로만 유지 */
    }
    listeners.forEach((l) => l(ids));
  };
  return function useStore() {
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
      if (cur.length >= max) return "full";
      write([...cur, id]);
      return "added";
    }, []);
    const clear = useCallback(() => write([]), []);
    const set = useCallback((v: string[]) => write(v.slice(0, max)), []);
    return { ids, toggle, clear, set, max };
  };
}

export const MAX_COMPARE = 4;
export const MAX_SAMPLER = 6;
export const useCompare = makeStore("cd.compare.v1", MAX_COMPARE);
export const useSampler = makeStore("dg.sampler.v1", MAX_SAMPLER);
