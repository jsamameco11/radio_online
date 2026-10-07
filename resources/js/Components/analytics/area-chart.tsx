import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export interface ChartPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  points: ChartPoint[];
  /** Text color class of the line and area, e.g. "text-signal". */
  tone?: string;
  height?: number;
  format?: (value: number) => string;
  className?: string;
  ariaLabel: string;
}

const WIDTH = 640;
const PADDING_Y = 12;

/** Responsive SVG area chart with a hover readout; scales to its container width. */
export function AreaChart({ points, tone = "text-signal", height = 180, format = String, className, ariaLabel }: AreaChartProps) {
  const gradient = useId();
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) return null;

  const max = Math.max(1, ...points.map((point) => point.value));
  const step = points.length > 1 ? WIDTH / (points.length - 1) : WIDTH;
  const x = (index: number) => (points.length > 1 ? index * step : WIDTH / 2);
  const y = (value: number) => height - PADDING_Y - (value / max) * (height - PADDING_Y * 2);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const shown = active ?? points.length - 1;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span>{points[shown].label}</span>
        <span className="font-semibold text-ink tabular">{format(points[shown].value)}</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        className={cn("h-auto w-full overflow-visible", tone)}
        style={{ aspectRatio: `${WIDTH} / ${height}` }}
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={0} x2={WIDTH} y1={height * ratio} y2={height * ratio} className="stroke-line" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#${gradient})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <line x1={x(shown)} x2={x(shown)} y1={0} y2={height} stroke="currentColor" strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
        <circle cx={x(shown)} cy={y(points[shown].value)} r={4} fill="currentColor" />
        {points.map((point, index) => (
          <rect
            key={point.label}
            x={x(index) - step / 2}
            y={0}
            width={step}
            height={height}
            fill="transparent"
            onMouseEnter={() => setActive(index)}
          >
            <title>{`${point.label}: ${format(point.value)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex justify-between text-[0.7rem] text-faint">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
