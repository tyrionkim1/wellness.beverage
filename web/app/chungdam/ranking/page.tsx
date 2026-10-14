import { Suspense } from "react";
import type { Metadata } from "next";
import RankingView from "./RankingView";
import "../chungdam.css";

export const metadata: Metadata = { title: "기준 공개 랭킹 — 청담음료" };

export default function Page() {
  return <Suspense fallback={null}><RankingView /></Suspense>;
}
