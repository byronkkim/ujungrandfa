"use client";

import Link from "next/link";
import { useState } from "react";
import { StarIcon } from "@/components/StarIcon";
import { ConfigBanner } from "@/components/ConfigBanner";
import { useStars } from "@/lib/useStars";
import { StarSize } from "@/lib/supabase";

export default function GrandpaPage() {
  const { stars, sb } = useStars();
  const [busy, setBusy] = useState(false);

  const makeStar = async (size: StarSize) => {
    if (!sb || busy) return;
    setBusy(true);
    await sb.from("stars").insert({ size, location: "inbox" });
    setBusy(false);
  };

  const inbox = stars.filter((s) => s.location === "inbox");
  const onBoard = stars.filter((s) => s.location === "board");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">👴 할아버지</h1>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← 처음으로
        </Link>
      </header>

      <ConfigBanner />

      <section className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => makeStar("big")}
          disabled={busy || !sb}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 py-10 transition hover:bg-amber-100 disabled:opacity-50"
        >
          <StarIcon size="big" />
          <span className="text-lg font-semibold text-amber-900">
            큰별 만들기
          </span>
        </button>
        <button
          onClick={() => makeStar("small")}
          disabled={busy || !sb}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 py-10 transition hover:bg-amber-100 disabled:opacity-50"
        >
          <StarIcon size="small" />
          <span className="text-lg font-semibold text-amber-900">
            작은별 만들기
          </span>
        </button>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          아직 안 보낸 별 ({inbox.length}개)
        </h2>
        <div className="flex min-h-[88px] flex-wrap items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          {inbox.length === 0 && (
            <span className="text-sm text-slate-400">
              버튼을 눌러 별을 만들어 보세요.
            </span>
          )}
          {inbox.map((s) => (
            <StarIcon key={s.id} size={s.size} />
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          손자가 별판에 올린 별: {onBoard.length}개
        </p>
      </section>
    </main>
  );
}
