"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, Star, Gift } from "./supabase";

// 별과 전달기록을 함께 불러오고 Supabase 실시간 변경을 구독하는 공용 훅.
export function useGame() {
  const sb = getSupabase();
  const [stars, setStars] = useState<Star[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  // Supabase 설정이 없으면 기다릴 게 없으니 처음부터 ready
  const [ready, setReady] = useState(!sb);

  const reload = useCallback(async () => {
    if (!sb) return;
    const [a, b] = await Promise.all([
      sb.from("stars").select("*").order("created_at", { ascending: true }),
      sb.from("gifts").select("*").order("created_at", { ascending: false }),
    ]);
    if (a.data) setStars(a.data as Star[]);
    if (b.data) setGifts(b.data as Gift[]);
    setReady(true);
  }, [sb]);

  useEffect(() => {
    if (!sb) return;
    // reload는 async라서 상태 변경이 await 뒤에 일어난다(= 렌더 중 연쇄 setState 아님).
    // 마운트 시 최초 로드는 effect 말고는 둘 곳이 없어 규칙을 여기서만 끈다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const channel = sb
      .channel("game-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stars" },
        () => reload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gifts" },
        () => reload()
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [sb, reload]);

  return { stars, gifts, ready, reload, sb };
}
