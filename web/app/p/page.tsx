import { Suspense } from "react";
import DetailView from "@/components/DetailView";

export const metadata = { title: "성분 상세 — 청담음료" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DetailView />
    </Suspense>
  );
}
