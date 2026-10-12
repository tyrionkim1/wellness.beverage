import { Suspense } from "react";
import ListView from "@/components/ListView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ListView />
    </Suspense>
  );
}
