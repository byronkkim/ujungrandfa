import Link from "next/link";
import { ConfigBanner } from "@/components/ConfigBanner";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <h1 className="text-4xl font-bold text-slate-800">⭐ 별 모으기 ⭐</h1>
      <p className="text-slate-500">
        할아버지가 별을 만들어 주면, 우주가 별판에 모아요.
      </p>

      {/* 1번 — 탱크 게임 */}
      <Link
        href="/game"
        className="relative w-full rounded-2xl border-2 border-slate-700 bg-slate-800 px-6 py-8 text-2xl font-semibold text-white shadow-sm transition hover:scale-[1.02] hover:bg-slate-700"
      >
        <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          1
        </span>
        🚀 우주의 탱크 게임
        <span className="mt-2 block text-sm font-normal text-slate-300">
          점프하고 미사일 쏘고 보스 물리치기
        </span>
      </Link>

      {/* 2번·3번 — 별 모으기 */}
      <div className="grid w-full gap-5 sm:grid-cols-2">
        <Link
          href="/grandpa"
          className="relative rounded-2xl border-2 border-orange-300 bg-orange-50 px-6 py-10 text-xl font-semibold text-orange-900 shadow-sm transition hover:scale-[1.02] hover:bg-orange-100"
        >
          <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-orange-200 text-sm font-bold text-orange-900">
            2
          </span>
          👴 할아버지
          <span className="mt-2 block text-sm font-normal text-orange-700">
            큰별·작은별 만들기
          </span>
        </Link>
        <Link
          href="/grandson"
          className="relative rounded-2xl border-2 border-blue-300 bg-blue-50 px-6 py-10 text-xl font-semibold text-blue-900 shadow-sm transition hover:scale-[1.02] hover:bg-blue-100"
        >
          <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-blue-200 text-sm font-bold text-blue-900">
            3
          </span>
          🧒 우주
          <span className="mt-2 block text-sm font-normal text-blue-700">
            별판에 별 모으기
          </span>
        </Link>
      </div>

      <ConfigBanner />
    </main>
  );
}
