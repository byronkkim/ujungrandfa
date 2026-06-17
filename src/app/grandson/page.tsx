"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { StarIcon } from "@/components/StarIcon";
import { ConfigBanner } from "@/components/ConfigBanner";
import { useStars } from "@/lib/useStars";
import { Star, SMALL_PER_BIG } from "@/lib/supabase";

const BOARD_SLOTS = 12; // 4 x 3

function DraggableStar({ star }: { star: Star }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: star.id,
    data: { star },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="touch-none cursor-grab active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <StarIcon size={star.size} />
    </button>
  );
}

function BoardSlot({
  index,
  star,
  onStarClick,
}: {
  index: number;
  star?: Star;
  onStarClick: (star: Star) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex aspect-square items-center justify-center rounded-xl border-2 transition ${
        isOver
          ? "border-sky-500 bg-sky-100"
          : "border-dashed border-slate-300 bg-white"
      }`}
    >
      {star ? (
        <div
          onClick={() => star.size === "big" && onStarClick(star)}
          title={star.size === "big" ? "큰별을 누르면 작은별 3개로 나뉘어요" : ""}
        >
          {star.size === "big" ? (
            // 큰별은 클릭으로 분리 → 드래그 대신 클릭 우선
            <span className="cursor-pointer">
              <StarIcon size="big" />
            </span>
          ) : (
            <DraggableStar star={star} />
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function GrandsonPage() {
  const { stars, sb } = useStars();
  const [activeStar, setActiveStar] = useState<Star | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const inbox = useMemo(
    () => stars.filter((s) => s.location === "inbox"),
    [stars]
  );
  const board = useMemo(
    () => stars.filter((s) => s.location === "board"),
    [stars]
  );

  // slot index -> star
  const bySlot = useMemo(() => {
    const map = new Map<number, Star>();
    board.forEach((s) => {
      if (s.slot != null) map.set(s.slot, s);
    });
    return map;
  }, [board]);

  const emptySlots = useMemo(
    () =>
      Array.from({ length: BOARD_SLOTS }, (_, i) => i).filter(
        (i) => !bySlot.has(i)
      ),
    [bySlot]
  );

  const smallOnBoard = board.filter((s) => s.size === "small");

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveStar((e.active.data.current?.star as Star) ?? null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveStar(null);
    if (!sb) return;
    const star = e.active.data.current?.star as Star | undefined;
    const overId = e.over?.id?.toString();
    if (!star || !overId?.startsWith("slot-")) return;
    const slot = Number(overId.replace("slot-", ""));
    if (bySlot.has(slot)) return; // 이미 차 있는 칸이면 무시
    await sb
      .from("stars")
      .update({ location: "board", slot })
      .eq("id", star.id);
  };

  // 작은별 3개 → 큰별 1개
  const combine = async () => {
    if (!sb) return;
    if (smallOnBoard.length < SMALL_PER_BIG) {
      flash(`작은별이 ${SMALL_PER_BIG}개 있어야 합쳐요!`);
      return;
    }
    const [keep, ...rest] = smallOnBoard
      .slice(0, SMALL_PER_BIG)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    await sb.from("stars").update({ size: "big" }).eq("id", keep.id);
    await sb
      .from("stars")
      .delete()
      .in(
        "id",
        rest.map((s) => s.id)
      );
    flash("작은별 3개가 큰별이 됐어요! ⭐");
  };

  // 큰별 1개 → 작은별 3개
  const split = async (big: Star) => {
    if (!sb) return;
    if (emptySlots.length < SMALL_PER_BIG - 1) {
      flash("빈 칸이 부족해서 나눌 수 없어요!");
      return;
    }
    await sb.from("stars").update({ size: "small" }).eq("id", big.id);
    const targets = emptySlots.slice(0, SMALL_PER_BIG - 1);
    await sb.from("stars").insert(
      targets.map((slot) => ({
        size: "small" as const,
        location: "board" as const,
        slot,
      }))
    );
    flash("큰별이 작은별 3개로 나뉘었어요! ✨");
  };

  const filled = board.length;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-sky-900">🧒 손자</h1>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            ← 처음으로
          </Link>
        </header>

        <ConfigBanner />

        {message && (
          <div className="mb-4 rounded-xl bg-sky-100 px-4 py-2 text-center text-sm font-medium text-sky-800">
            {message}
          </div>
        )}

        {/* 받은 별 (드래그 시작 영역) */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">
            받은 별 ({inbox.length}개) — 끌어서 별판에 놓으세요
          </h2>
          <div className="flex min-h-[80px] flex-wrap items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            {inbox.length === 0 && (
              <span className="text-sm text-slate-400">
                할아버지가 별을 보내면 여기에 나타나요.
              </span>
            )}
            {inbox.map((s) => (
              <DraggableStar key={s.id} star={s} />
            ))}
          </div>
        </section>

        {/* 별판 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">
              별판 ({filled}/{BOARD_SLOTS})
            </h2>
            <button
              onClick={combine}
              disabled={smallOnBoard.length < SMALL_PER_BIG}
              className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✨ 작은별 3개 합치기
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4">
            {Array.from({ length: BOARD_SLOTS }, (_, i) => (
              <BoardSlot
                key={i}
                index={i}
                star={bySlot.get(i)}
                onStarClick={split}
              />
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            작은별 3개 = 큰별 1개 · 큰별을 누르면 작은별 3개로 나뉘어요
          </p>
        </section>
      </main>

      <DragOverlay>
        {activeStar ? <StarIcon size={activeStar.size} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
