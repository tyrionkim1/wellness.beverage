import { Suspense } from "react";
import CompareView from "@/components/CompareView";

export const metadata = { title: "스펙 비교 — 청담음료" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompareView />
    </Suspense>
  );
}
