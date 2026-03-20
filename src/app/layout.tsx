import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venn AI - 概念维恩图",
  description: "AI 驱动的嵌套维恩图生成器",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
