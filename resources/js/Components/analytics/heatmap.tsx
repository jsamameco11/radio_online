import { cn } from "@/lib/cn";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
/** Monday first, as listeners read a week. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Sessions by weekday (0 = Sunday) and hour, as a 7 × 24 grid. */
export function Heatmap({ matrix, className }: { matrix: number[][]; className?: string }) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-separate border-spacing-0.5 text-[0.65rem] text-faint" aria-label="Sesiones por día y hora">
        <thead>
          <tr>
            <th className="w-9" />
            {Array.from({ length: 24 }, (_, hour) => (
              <th key={hour} className="font-normal tabular">
                {hour % 3 === 0 ? hour : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((weekday) => (
            <tr key={weekday}>
              <th className="pr-1 text-left font-normal">{WEEKDAYS[weekday]}</th>
              {matrix[weekday].map((value, hour) => (
                <td key={hour} className="p-0">
                  <div
                    className="h-5 min-w-3 rounded-[3px] bg-signal"
                    style={{ opacity: value === 0 ? 0.06 : 0.18 + (value / max) * 0.82 }}
                    title={`${WEEKDAYS[weekday]} ${hour}:00 · ${value} sesiones`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
