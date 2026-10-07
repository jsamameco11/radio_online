import { cn } from "@/lib/cn";
import type { ChartPoint } from "@/Components/analytics/area-chart";

interface ColumnChartProps {
  points: ChartPoint[];
  /** Fill color class of the columns, e.g. "fill-onair". */
  tone?: string;
  height?: number;
  format?: (value: number) => string;
  className?: string;
  ariaLabel: string;
}

const WIDTH = 640;

/** Vertical columns for daily counts; every column has a native tooltip. */
export function ColumnChart({ points, tone = "fill-onair", height = 160, format = String, className, ariaLabel }: ColumnChartProps) {
  if (points.length === 0) return null;

  const max = Math.max(1, ...points.map((point) => point.value));
  const slot = WIDTH / points.length;
  const bar = Math.max(2, slot * 0.68);

  return (
    <div className={cn("space-y-2", className)}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} className="h-auto w-full" style={{ aspectRatio: `${WIDTH} / ${height}` }}>
        <line x1={0} x2={WIDTH} y1={height - 0.5} y2={height - 0.5} className="stroke-line" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => {
          const h = (point.value / max) * (height - 8);
          return (
            <rect key={point.label} x={index * slot + (slot - bar) / 2} y={height - h} width={bar} height={Math.max(h, point.value > 0 ? 2 : 0)} rx={2} className={tone}>
              <title>{`${point.label}: ${format(point.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-[0.7rem] text-faint">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
