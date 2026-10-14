import type { Metadata } from "next";
import ChungdamView from "./ChungdamView";
import "./chungdam.css";

export const metadata: Metadata = {
  title: "청담음료 — 매일 마시는 한 잔, 기준 있게",
  description: "당류·단백질·원재료를 식약처 공개 데이터로 비교하고, 나의 목표에 맞는 음료를 찾아보세요.",
  openGraph: {
    title: "청담음료 — 매일 마시는 한 잔, 기준 있게",
    description: "당류부터 단백질, 원재료까지. 나에게 맞는 한 잔을 찾아보세요.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function Page() {
  return <ChungdamView />;
}
