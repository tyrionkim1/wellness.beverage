import type { Metadata } from "next";
import AboutView from "./AboutView";
import "../chungdam.css";

export const metadata: Metadata = { title: "분석 방법 — 청담음료" };

export default function Page() {
  return <AboutView />;
}
