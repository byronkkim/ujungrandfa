import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type StarSize = "small" | "big";

export interface Star {
  id: string;
  size: StarSize;
  slot: number | null; // null = 미배치 풀, 0~19 = 별판 슬롯
  gift_id: string | null;
  created_at: string;
}

export interface Gift {
  id: string;
  small_count: number;
  big_count: number;
  memo: string | null;
  created_at: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// URL이 비었거나 https URL이 아니면 createClient가 throw 하며 빌드가 깨진다. 미리 거른다.
function isValidHttpUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidHttpUrl(url) && Boolean(anon);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    try {
      client = createClient(url!, anon!);
    } catch {
      return null;
    }
  }
  return client;
}

// 작은별 3개 = 큰별 1개
export const SMALL_PER_BIG = 3;

// 별판 슬롯: 큰별 10 + 작은별 10을 우주 하늘에 흩뿌린 고정 배치(%, 컨테이너 기준).
export interface SlotDef {
  size: StarSize;
  x: number;
  y: number;
}

// 중심(50, 49) 기준으로 가로·세로 간격을 절반으로 좁힌 배치.
export const SLOTS: SlotDef[] = [
  { size: "big", x: 30, y: 31.5 },
  { size: "small", x: 40, y: 30 },
  { size: "big", x: 50, y: 32.5 },
  { size: "small", x: 60.5, y: 29.5 },
  { size: "big", x: 70, y: 32 },
  { size: "small", x: 31.5, y: 44 },
  { size: "big", x: 41, y: 42.5 },
  { size: "small", x: 49.5, y: 45.5 },
  { size: "big", x: 59, y: 43 },
  { size: "small", x: 69, y: 44.5 },
  { size: "big", x: 29.5, y: 56 },
  { size: "small", x: 40, y: 57.5 },
  { size: "big", x: 51, y: 54.5 },
  { size: "small", x: 60, y: 56.5 },
  { size: "big", x: 70.5, y: 55.5 },
  { size: "small", x: 32, y: 67.5 },
  { size: "big", x: 41.5, y: 68.5 },
  { size: "small", x: 49.5, y: 66.5 },
  { size: "big", x: 59.5, y: 68 },
  { size: "small", x: 69, y: 67 },
];

export const TOTAL_SLOTS = SLOTS.length; // 20
export const BIG_SLOTS = SLOTS.filter((s) => s.size === "big").length; // 10
export const SMALL_SLOTS = SLOTS.filter((s) => s.size === "small").length; // 10

export function filledSlotSet(stars: Star[]): Set<number> {
  return new Set(
    stars.filter((s) => s.slot != null).map((s) => s.slot as number)
  );
}

export function isComplete(stars: Star[]): boolean {
  return filledSlotSet(stars).size >= TOTAL_SLOTS;
}
