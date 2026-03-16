import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HKMC/TW 스토어 대시보드",
  description: "매출, 수익, 할인율, BEP 흐름을 한눈에 보는 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
