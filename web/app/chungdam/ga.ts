"use client";
// 청담음료 전용 GA4 속성 (KAIST MBA 8조 계정 > "청담음료 MVP"). 랜딩 검증용 웰니스/헬창 속성과 분리.
import { useEffect } from "react";

export const GA_ID = "G-8J6P5NK4LB";

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
}

export function ga(event: string, params: Record<string, unknown> = {}) {
  try { window.gtag?.("event", event, { page_group: "chungdam_mvp", ...params }); } catch { /* noop */ }
}

/** 페이지 진입 시 GA 로드 + page_view(자동) + 진입 이벤트 1회 */
export function useGA(entryEvent?: string, params?: Record<string, unknown>) {
  useEffect(() => {
    if (!window.gtag) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
      window.gtag("js", new Date());
      window.gtag("config", GA_ID);
    }
    if (entryEvent) ga(entryEvent, params);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
