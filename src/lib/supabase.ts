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

// 보드 전체에 꽉 차게 펼친 배치 (5열 x 4행, 살짝 흩뜨림).
export const SLOTS: SlotDef[] = [
  { size: "big", x: 11, y: 13 },
  { size: "small", x: 31, y: 10 },
  { size: "big", x: 50, y: 15 },
  { size: "small", x: 70, y: 9 },
  { size: "big", x: 89, y: 14 },
  { size: "small", x: 9, y: 39 },
  { size: "big", x: 30, y: 35 },
  { size: "small", x: 50, y: 41 },
  { size: "big", x: 70, y: 36 },
  { size: "small", x: 91, y: 39 },
  { size: "big", x: 10, y: 63 },
  { size: "small", x: 30, y: 66 },
  { size: "big", x: 51, y: 60 },
  { size: "small", x: 71, y: 64 },
  { size: "big", x: 90, y: 62 },
  { size: "small", x: 12, y: 89 },
  { size: "big", x: 32, y: 91 },
  { size: "small", x: 50, y: 86 },
  { size: "big", x: 70, y: 90 },
  { size: "small", x: 90, y: 88 },
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
