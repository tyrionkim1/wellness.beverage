import { Suspense } from "react";
import type { Metadata } from "next";
import ChungdamDetail from "./ChungdamDetail";
import "../chungdam.css";

export const metadata: Metadata = { title: "성분 자세히 보기 — 청담음료" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChungdamDetail />
    </Suspense>
  );
}
