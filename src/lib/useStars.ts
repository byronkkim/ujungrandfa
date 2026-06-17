"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, Star } from "./supabase";

// 별 목록을 불러오고 Supabase 실시간 변경을 구독하는 공용 훅.
// 할아버지가 별을 만들면 손자 화면이 즉시 갱신된다.
export function useStars() {
  const [stars, setStars] = useState<Star[]>([]);
  const [ready, setReady] = useState(false);
  const sb = getSupabase();

  const reload = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb
      .from("stars")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setStars(data as Star[]);
    setReady(true);
  }, [sb]);

  useEffect(() => {
    if (!sb) {
      setReady(true);
      return;
    }
    reload();
    const channel = sb
      .channel("stars-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stars" },
        () => reload()
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [sb, reload]);

  return { stars, ready, reload, sb };
}
