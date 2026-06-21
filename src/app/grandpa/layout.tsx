import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "할아버지", // → "별 모으기 - 할아버지"
};

export default function GrandpaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
