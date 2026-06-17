import { StarSize } from "@/lib/supabase";

const SIZES: Record<StarSize, number> = {
  small: 34,
  big: 60,
};

const STAR_PATH =
  "M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.77l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z";

// 별 SVG. variant="filled"=금색 채운 별, variant="empty"=흰색 외곽선만(빈 자리).
export function StarIcon({
  size,
  px,
  variant = "filled",
}: {
  size: StarSize;
  px?: number;
  variant?: "filled" | "empty";
}) {
  const dimension = px ?? SIZES[size];
  const filled = variant === "filled";
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={
        filled
          ? { filter: "drop-shadow(0 0 6px rgba(250,204,21,0.7))" }
          : undefined
      }
    >
      <path
        d={STAR_PATH}
        fill={filled ? "#facc15" : "rgba(255,255,255,0.06)"}
        stroke={filled ? "#eab308" : "rgba(255,255,255,0.85)"}
        strokeWidth={filled ? 1 : 1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}
