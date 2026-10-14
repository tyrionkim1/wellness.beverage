import { Suspense } from "react";
import type { Metadata } from "next";
import SamplerDetail from "./SamplerDetail";
import "../../chungdam.css";

export const metadata: Metadata = { title: "샘플러 상세 — 청담음료" };

export default function Page() {
  return <Suspense fallback={null}><SamplerDetail /></Suspense>;
}
