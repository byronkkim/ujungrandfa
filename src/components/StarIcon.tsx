import { StarSize } from "@/lib/supabase";

const SIZES: Record<StarSize, number> = {
  small: 34,
  big: 64,
};

// 노란 별 SVG. size에 따라 크기만 달라진다.
export function StarIcon({
  size,
  px,
}: {
  size: StarSize;
  px?: number;
}) {
  const dimension = px ?? SIZES[size];
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.77l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"
        fill="#facc15"
        stroke="#eab308"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
