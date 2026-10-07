import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/radio/format";
import { ActionNotice } from "./action-notice";
import { useScheduleAction } from "./use-schedule-action";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Most days a copy reaches at once (CopyScheduleDayRequest). */
const MAX_TARGETS = 31;

function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Copies the whole day (every layer) to other dates, or empties what is left of it. */
export function DayTools({ copyUrl, clearUrl, date, today, hasBlocks }: { copyUrl: string; clearUrl: string; date: string; today: string; hasBlocks: boolean }) {
  const tomorrow = addDays(date > today ? date : today, 1);
  const [from, setFrom] = useState(tomorrow);
  const [to, setTo] = useState(addDays(tomorrow, 6));
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [replace, setReplace] = useState(false);
  const { result, setResult, pending, run } = useScheduleAction();

  const targets = useMemo(() => {
    const list: string[] = [];
    for (let day = from; day <= to && list.length <= MAX_TARGETS; day = addDays(day, 1)) {
      if (day !== date && day >= today && weekdays.includes(weekday(day))) list.push(day);
    }
    return list;
  }, [from, to, weekdays, date, today]);

  function copy(event: FormEvent) {
    event.preventDefault();
    if (replace && !window.confirm(`Se reemplazará la programación de ${targets.length} día(s). ¿Continuar?`)) return;
    void run("post", copyUrl, { date, targets, replace });
  }

  function clear() {
    if (window.confirm("¿Quitar todos los bloques de este día (desde ahora), en todas las pistas?")) void run("delete", clearUrl);
  }

  return (
    <Panel title="Repetir este día" description="Copia toda la programación del día (pista principal y capas) a otras fechas. Ideal para una parrilla semanal.">
      <form onSubmit={copy} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Desde">{(id) => <Input id={id} type="date" value={from} min={today} onChange={(event) => setFrom(event.target.value)} />}</Field>
          <Field label="Hasta">{(id) => <Input id={id} type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />}</Field>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días de la semana">
          {WEEKDAYS.map((label, index) => {
            const on = weekdays.includes(index);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => setWeekdays((list) => (on ? list.filter((value) => value !== index) : [...list, index]))}
                className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition", on ? "bg-signal-soft text-signal" : "bg-raised text-muted hover:text-ink")}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Checkbox label="Reemplazar lo que ya esté programado" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
        {targets.length > MAX_TARGETS ? <p className="text-xs text-warning">Elige como máximo {MAX_TARGETS} días a la vez.</p> : null}
        <ActionNotice result={result} onClose={() => setResult(null)} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending} disabled={!hasBlocks || targets.length === 0 || targets.length > MAX_TARGETS}>
            Copiar a {targets.length} día{targets.length === 1 ? "" : "s"}
          </Button>
          {hasBlocks && date >= today ? (
            <Button variant="danger" disabled={pending} onClick={clear}>
              Vaciar día
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}
