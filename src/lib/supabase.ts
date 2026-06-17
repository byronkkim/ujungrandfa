import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type StarSize = "small" | "big";
export type StarLocation = "inbox" | "board";

export interface Star {
  id: string;
  size: StarSize;
  location: StarLocation;
  slot: number | null;
  created_at: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 환경 변수가 설정되기 전에도 앱이 죽지 않도록 lazy 싱글톤으로 보관한다.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  if (!client) client = createClient(url, anon);
  return client;
}

export const isSupabaseConfigured = Boolean(url && anon);

// 작은별 3개 = 큰별 1개
export const SMALL_PER_BIG = 3;
