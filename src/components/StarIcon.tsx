import { StarSize } from "@/lib/supabase";

const SIZES: Record<StarSize, number> = {
  small: 34,
  big: 60,
};

const STAR_PATH =
  "M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.77l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z";

// 큰별·작은별 색을 살짝 다르게: 큰별=주황빛 골드, 작은별=노랑.
const COLORS: Record<StarSize, { fill: string; stroke: string; glow: string }> =
  {
    big: { fill: "#fb923c", stroke: "#ea580c", glow: "rgba(251,146,60,0.7)" },
    small: { fill: "#fde047", stroke: "#eab308", glow: "rgba(253,224,71,0.7)" },
  };

// 별 SVG. variant="filled"=색 채운 별, variant="empty"=흰색 외곽선만(빈 자리).
export function StarIcon({
  size,
  px,
  variant = "filled",
  className,
}: {
  size: StarSize;
  px?: number;
  variant?: "filled" | "empty";
  className?: string;
}) {
  const dimension = px ?? SIZES[size];
  const filled = variant === "filled";
  const c = COLORS[size];
  return (
    <svg
      width={dimension}
      height={dimension}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={
        filled ? { filter: `drop-shadow(0 0 6px ${c.glow})` } : undefined
      }
    >
      <path
        d={STAR_PATH}
        fill={filled ? c.fill : "rgba(255,255,255,0.06)"}
        stroke={filled ? c.stroke : "rgba(255,255,255,0.85)"}
        strokeWidth={filled ? 1 : 1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}
