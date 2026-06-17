"use client";

import Link from "next/link";
import { useState } from "react";
import { StarIcon } from "@/components/StarIcon";
import { ConfigBanner } from "@/components/ConfigBanner";
import { useGame } from "@/lib/useGame";
import { Gift, TOTAL_SLOTS, filledSlotSet, isComplete } from "@/lib/supabase";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function GrandpaPage() {
  const { stars, gifts, sb } = useGame();
  const [pendingSmall, setPendingSmall] = useState(0);
  const [pendingBig, setPendingBig] = useState(0);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const completed = isComplete(stars);
  const placed = filledSlotSet(stars).size;

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(null), 2200);
  };

  const send = async () => {
    if (!sb || busy || completed) return;
    const total = pendingSmall + pendingBig;
    if (total === 0) {
      flash("별을 먼저 만들어 주세요!");
      return;
    }
    setBusy(true);
    const { data: gift } = await sb
      .from("gifts")
      .insert({
        small_count: pendingSmall,
        big_count: pendingBig,
        memo: memo.trim() || null,
      })
      .select()
      .single();
    const rows = [
      ...Array.from({ length: pendingSmall }, () => ({
        size: "small" as const,
        gift_id: gift?.id ?? null,
      })),
      ...Array.from({ length: pendingBig }, () => ({
        size: "big" as const,
        gift_id: gift?.id ?? null,
      })),
    ];
    await sb.from("stars").insert(rows);
    setPendingSmall(0);
    setPendingBig(0);
    setMemo("");
    setBusy(false);
    flash("별을 보냈어요! ⭐");
  };

  const reset = async () => {
    if (!sb || busy) return;
    if (!confirm("정말 초기화할까요? 모든 별과 기록이 사라집니다.")) return;
    setBusy(true);
    await sb.from("stars").delete().not("id", "is", null);
    await sb.from("gifts").delete().not("id", "is", null);
    setBusy(false);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">👴 할아버지</h1>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← 처음으로
        </Link>
      </header>

      <ConfigBanner />

      {msg && (
        <div className="mb-4 rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-800">
          {msg}
        </div>
      )}

      {completed && (
        <div className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-6 text-center">
          <div className="text-2xl">🎉🌟🎉</div>
          <p className="mt-2 text-lg font-bold text-amber-900">
            손자가 모든 별을 모았습니다.
          </p>
          <p className="text-amber-800">축하해주세요!</p>
          <button
            onClick={reset}
            disabled={busy}
            className="mt-4 rounded-full bg-amber-500 px-6 py-2 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
          >
            🔄 초기화하기
          </button>
        </div>
      )}

      {!completed && (
        <>
          {/* 별 만들기 */}
          <section className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setPendingBig((n) => n + 1)}
              disabled={!sb}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 py-8 transition hover:bg-amber-100 disabled:opacity-50"
            >
              <StarIcon size="big" />
              <span className="font-semibold text-amber-900">큰별 만들기</span>
            </button>
            <button
              onClick={() => setPendingSmall((n) => n + 1)}
              disabled={!sb}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 py-8 transition hover:bg-amber-100 disabled:opacity-50"
            >
              <StarIcon size="small" />
              <span className="font-semibold text-amber-900">작은별 만들기</span>
            </button>
          </section>

          {/* 보낼 준비 + 메모 + 보내기 */}
          <section className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">
                보낼 별: 큰별 {pendingBig} · 작은별 {pendingSmall}
              </span>
              {pendingBig + pendingSmall > 0 && (
                <button
                  onClick={() => {
                    setPendingBig(0);
                    setPendingSmall(0);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  비우기
                </button>
              )}
            </div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모 (선택) — 예: 우리 강아지 심부름 잘했어요 🐶"
              rows={2}
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
            />
            <button
              onClick={send}
              disabled={busy || !sb || pendingBig + pendingSmall === 0}
              className="mt-3 w-full rounded-xl bg-amber-500 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              📨 손자에게 보내기
            </button>
          </section>
        </>
      )}

      {/* 진행 상황 */}
      <p className="mt-6 text-center text-sm text-slate-500">
        손자가 모은 별: <b className="text-amber-700">{placed}</b> / {TOTAL_SLOTS}
      </p>

      {/* 전달 기록 */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          전달 기록 ({gifts.length}번)
        </h2>
        <div className="space-y-2">
          {gifts.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
              아직 보낸 별이 없어요.
            </p>
          )}
          {gifts.map((g: Gift) => (
            <div
              key={g.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-sm text-slate-700">
                <b>{formatDate(g.created_at)}</b> · 할아버지가{" "}
                <b className="text-amber-700">{g.big_count + g.small_count}개</b>
                의 별을 줬어요
                <span className="text-slate-400">
                  {" "}
                  (큰별 {g.big_count}, 작은별 {g.small_count})
                </span>
              </p>
              {g.memo && (
                <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
                  📝 {g.memo}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
