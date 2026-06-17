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
import { useGame } from "@/lib/useGame";
import {
  Star,
  SLOTS,
  TOTAL_SLOTS,
  SMALL_PER_BIG,
  filledSlotSet,
  isComplete,
} from "@/lib/supabase";

// 풀(미배치)에서 끌 수 있는 별
function PoolStar({ star }: { star: Star }) {
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

// 하늘에 흩뿌려진 슬롯 한 칸 (droppable)
function SkySlot({
  index,
  star,
  activeSize,
}: {
  index: number;
  star?: Star;
  activeSize?: "small" | "big";
}) {
  const def = SLOTS[index];
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });
  const canDrop = !star && activeSize === def.size;
  return (
    <div
      ref={setNodeRef}
      className={star ? "slot-filled" : "slot-empty"}
      style={{
        position: "absolute",
        left: `${def.x}%`,
        top: `${def.y}%`,
        transform: "translate(-50%, -50%)",
        borderRadius: "9999px",
        padding: 6,
        outline: isOver && canDrop ? "3px solid #7dd3fc" : "none",
        background:
          isOver && canDrop ? "rgba(125,211,252,0.18)" : "transparent",
        animationPlayState: isOver ? "paused" : "running",
      }}
    >
      <StarIcon size={def.size} variant={star ? "filled" : "empty"} />
    </div>
  );
}

export default function GrandsonPage() {
  const { stars, sb } = useGame();
  const [active, setActive] = useState<Star | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    })
  );

  const filled = useMemo(() => {
    const m = new Map<number, Star>();
    stars.forEach((s) => {
      if (s.slot != null) m.set(s.slot, s);
    });
    return m;
  }, [stars]);

  const pool = useMemo(() => stars.filter((s) => s.slot == null), [stars]);
  const poolSmall = pool.filter((s) => s.size === "small");
  const poolBig = pool.filter((s) => s.size === "big");
  const completed = isComplete(stars);
  const placedCount = filledSlotSet(stars).size;

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(null), 2200);
  };

  const onDragStart = (e: DragStartEvent) =>
    setActive((e.active.data.current?.star as Star) ?? null);

  const onDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    if (!sb) return;
    const star = e.active.data.current?.star as Star | undefined;
    const overId = e.over?.id?.toString();
    if (!star || !overId?.startsWith("slot-")) return;
    const slot = Number(overId.replace("slot-", ""));
    if (filled.has(slot)) return;
    if (SLOTS[slot].size !== star.size) {
      flash(SLOTS[slot].size === "big" ? "여긴 큰별 자리예요!" : "여긴 작은별 자리예요!");
      return;
    }
    // 한 번 배치하면 뺄 수 없음 → slot만 채우고 끝
    await sb.from("stars").update({ slot }).eq("id", star.id);
  };

  // 미배치 작은별 3개 → 큰별 1개
  const combine = async () => {
    if (!sb) return;
    if (poolSmall.length < SMALL_PER_BIG) {
      flash(`미배치 작은별이 ${SMALL_PER_BIG}개 있어야 합쳐요!`);
      return;
    }
    const [keep, ...rest] = poolSmall.slice(0, SMALL_PER_BIG);
    await sb.from("stars").update({ size: "big" }).eq("id", keep.id);
    await sb
      .from("stars")
      .delete()
      .in("id", rest.map((s) => s.id));
    flash("작은별 3개가 큰별이 됐어요! ⭐");
  };

  // 미배치 큰별 1개 → 작은별 3개
  const split = async () => {
    if (!sb) return;
    if (poolBig.length < 1) {
      flash("미배치 큰별이 1개 있어야 나눠요!");
      return;
    }
    const big = poolBig[0];
    await sb.from("stars").update({ size: "small" }).eq("id", big.id);
    await sb
      .from("stars")
      .insert([{ size: "small" }, { size: "small" }]);
    flash("큰별 1개가 작은별 3개로 나뉘었어요! ✨");
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <main className="flex min-h-full flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-sky-900">🧒 손자</h1>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
            ← 처음으로
          </Link>
        </header>

        <div className="px-6">
          <ConfigBanner />
        </div>

        {/* 우주 하늘 별판 */}
        <section className="relative mx-4 mb-4 overflow-hidden rounded-3xl">
          <div className="sky relative h-[58vh] min-h-[360px] w-full">
            {SLOTS.map((_, i) => (
              <SkySlot
                key={i}
                index={i}
                star={filled.get(i)}
                activeSize={active?.size}
              />
            ))}

            {/* 진행 / 안내 */}
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/30 px-4 py-1 text-sm text-white backdrop-blur">
              {placedCount} / {TOTAL_SLOTS} 모음
            </div>

            {msg && (
              <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-sky-800">
                {msg}
              </div>
            )}

            {completed && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 backdrop-blur-sm">
                <div className="text-5xl">🎉✨🌟✨🎉</div>
                <p className="mt-4 text-3xl font-extrabold text-white drop-shadow">
                  축하합니다!
                </p>
                <p className="mt-1 text-white/90">별을 모두 모았어요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 컨트롤 + 받은 별 풀 */}
        {!completed && (
          <section className="px-4 pb-8">
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={combine}
                disabled={poolSmall.length < SMALL_PER_BIG}
                className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
              >
                ✨ 합치기 (작은별 3 → 큰별 1)
              </button>
              <button
                onClick={split}
                disabled={poolBig.length < 1}
                className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-sky-950 transition hover:bg-sky-300 disabled:opacity-40"
              >
                ✂️ 나누기 (큰별 1 → 작은별 3)
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-center text-sm font-semibold text-slate-500">
                받은 별 — 끌어서 하늘의 빈 별에 넣어요 (큰별 {poolBig.length} · 작은별{" "}
                {poolSmall.length})
              </p>
              <div className="flex min-h-[70px] flex-wrap items-center justify-center gap-3">
                {pool.length === 0 ? (
                  <span className="text-sm text-slate-400">
                    할아버지가 별을 보내면 여기에 나타나요.
                  </span>
                ) : (
                  pool.map((s) => <PoolStar key={s.id} star={s} />)
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <DragOverlay>
        {active ? <StarIcon size={active.size} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
