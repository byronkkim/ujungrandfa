"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, Star, Gift } from "./supabase";

// 별과 전달기록을 함께 불러오고 Supabase 실시간 변경을 구독하는 공용 훅.
export function useGame() {
  const [stars, setStars] = useState<Star[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [ready, setReady] = useState(false);
  const sb = getSupabase();

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
    if (!sb) {
      setReady(true);
      return;
    }
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
