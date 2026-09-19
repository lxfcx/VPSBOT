import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prism · 玻璃探针",
  description: "全球服务器实时监控、智能告警与账单管理。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
