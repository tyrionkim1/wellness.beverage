import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui";

export const metadata: Metadata = {
  title: "득근음료 — 성분 숫자로 고르는 음료",
  description: "식약처 식품영양성분DB 기반. 단백질·당류·카페인을 숫자로 나란히 비교합니다. 순위·추천 없이 표시값만.",
  openGraph: {
    title: "득근음료 — 숫자로 고른다",
    description: "단백질 · 당류 · 카페인. 성분표만 나란히.",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A0B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=JetBrains+Mono:wght@500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
