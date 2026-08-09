import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "탱크 게임", // → "별 모으기 - 탱크 게임"
};

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
