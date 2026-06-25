import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "今日事，今日畢，To-Do List, To-Done List",
  description: "本機專案分工與期限追蹤工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
