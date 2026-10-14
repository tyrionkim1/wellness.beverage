import type { Metadata } from "next";
import SamplersView from "./SamplersView";
import "../chungdam.css";

export const metadata: Metadata = { title: "샘플러 — 청담음료" };

export default function Page() {
  return <SamplersView />;
}
