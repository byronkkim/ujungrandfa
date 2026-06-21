import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "우주", // → "별 모으기 - 우주"
};

export default function GrandsonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
