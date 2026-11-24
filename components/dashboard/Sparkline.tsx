interface SparklineProps {
  data?: number[];
  loading?: boolean;
  label?: string;
  description?: string;
}

export function Sparkline({
  data,
  loading = false,
  label = "Trend",
  description,
}: SparklineProps) {
  if (loading)
    return (
      <div
        className="mt-2 h-6 w-full animate-pulse rounded bg-white/5"
        aria-hidden="true"
      />
    );
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (value, index) =>
        `${(index / (data.length - 1)) * 100},${22 - ((value - min) / range) * 18}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 26"
      preserveAspectRatio="none"
      className="mt-2 h-6 w-full min-w-0 text-cyan-400"
      role="img"
      aria-label={label}
    >
      {description ? <title>{description}</title> : null}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        className="motion-reduce:transition-none"
      />
    </svg>
  );
}
