import Link from "next/link";
import { ConfigBanner } from "@/components/ConfigBanner";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <h1 className="text-4xl font-bold text-slate-800">⭐ 별 모으기 ⭐</h1>
      <p className="text-slate-500">
        할아버지가 별을 만들어 주면, 우주가 별판에 모아요.
      </p>

      <div className="grid w-full gap-5 sm:grid-cols-2">
        <Link
          href="/grandpa"
          className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-6 py-10 text-xl font-semibold text-amber-900 shadow-sm transition hover:scale-[1.02] hover:bg-amber-100"
        >
          👴 할아버지
          <span className="mt-2 block text-sm font-normal text-amber-700">
            큰별·작은별 만들기
          </span>
        </Link>
        <Link
          href="/grandson"
          className="rounded-2xl border-2 border-sky-300 bg-sky-50 px-6 py-10 text-xl font-semibold text-sky-900 shadow-sm transition hover:scale-[1.02] hover:bg-sky-100"
        >
          🧒 우주
          <span className="mt-2 block text-sm font-normal text-sky-700">
            별판에 별 모으기
          </span>
        </Link>
      </div>

      <ConfigBanner />
    </main>
  );
}
