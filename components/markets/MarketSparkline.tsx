interface Props {
  points: Array<{ time: string; value: number }>;
  positive: boolean | null;
}

export default function MarketSparkline({ points, positive }: Props) {
  if (points.length < 2) return <div className="h-10 text-xs text-gray-400 flex items-center">No history</div>;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 160;
  const height = 40;
  const path = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - 3 - ((point.value - min) / span) * (height - 6);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = points.at(-1)!;
  const lastX = width;
  const lastY = height - 3 - ((last.value - min) / span) * (height - 6);
  const color = positive == null ? "#6b7280" : positive ? "#16a34a" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" role="img" aria-label={`30-day price trend ending at ${last.value}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}
