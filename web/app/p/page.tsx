import { Suspense } from "react";
import DetailView from "@/components/DetailView";

export const metadata = { title: "성분 상세 — 득근음료" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DetailView />
    </Suspense>
  );
}
