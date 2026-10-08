import { Check, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { EFFECT_CATEGORIES, FACTORY_EFFECTS, STARTER_EFFECTS, previewEffect, stopPreview, type FactoryEffect } from "@/lib/radio/effects";
import { inBank, starterEffects, type PadsApi } from "./use-pads";
import { EFFECT_LABELS } from "./use-sounds";

export const effectLength = (seconds: number) => (seconds < 10 ? `${seconds.toFixed(1).replace(".", ",")} s` : duration(seconds));

export const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * The factory effects: categorized, heard here (only by the operator) before adding them, and
 * added to the pad bank one by one or as the basic set. They load in the background: the window
 * can be closed while they are added. Each one also stays in the library.
 */
export function EffectsLibrary({ bank, onClose }: { bank: PadsApi; onClose: () => void }) {
  const { pads, loading, report, max } = bank;
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    FACTORY_EFFECTS.forEach((item) => map.set(item.category, (map.get(item.category) ?? 0) + 1));
    return map;
  }, []);
  const search = fold(query.trim());
  const visible = FACTORY_EFFECTS.filter((item) => (search ? fold(`${item.title} ${EFFECT_LABELS.get(item.category)}`).includes(search) : !category || item.category === category));
  const pending = new Set([...(loading?.queued ?? []), ...(loading?.current ? [loading.current.id] : [])]);
  const free = max - pads.length - pending.size;
  const starter = starterEffects().filter((item) => !inBank(pads, item));
  const missingStarter = starter.filter((item) => !pending.has(item.id)).length;
  const hint = EFFECT_CATEGORIES.find((item) => item.id === category)?.hint;

  useEffect(() => () => stopPreview(), []);

  function toggle(item: FactoryEffect) {
    if (playing === item.id) {
      stopPreview();
      setPlaying(null);
      return;
    }
    setPlaying(item.id);
    void previewEffect(item, () => setPlaying((value) => (value === item.id ? null : value)));
  }

  function close() {
    stopPreview();
    onClose();
  }

  return (
    <Modal
      open
      onClose={close}
      size="xl"
      title="Efectos de fábrica"
      description={`${FACTORY_EFFECTS.length} sonidos en ${EFFECT_CATEGORIES.length} categorías. Escúchalos aquí (solo tú) y agrégalos a la botonera con un clic. Botonera: ${pads.length}/${max}.`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-xs break-words text-muted">
            {loading
              ? "Se cargan en segundo plano: puedes cerrar esta ventana y seguir trabajando en la consola."
              : `${free > 0 ? `Quedan ${free} botones libres.` : "Botonera llena: quita botones con «Editar» para sumar otros."} Cada efecto queda también en la biblioteca.`}
          </p>
          <Button onClick={close} variant={loading ? "secondary" : "primary"}>
            {loading ? "Seguir en segundo plano" : "Listo"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-raised p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Botonera básica</p>
            <p className="text-xs break-words text-muted">Aplausos, redoble, ta-dá, risas, boing, trombón triste, whoosh, campana, coro, jingle y más: {STARTER_EFFECTS.length} efectos listos para hacer radio.</p>
          </div>
          <Button size="sm" variant="signal" disabled={!missingStarter} onClick={() => bank.load(starter)}>
            {missingStarter ? "Cargar botonera básica" : starter.length ? "Cargando…" : "Ya está cargada"}
          </Button>
        </div>

        {loading ? <PadLoadingBar bank={bank} /> : null}

        <div className="flex flex-wrap gap-1.5">
          <CategoryChip on={!category} onClick={() => setCategory("")} label="Todos" count={FACTORY_EFFECTS.length} />
          {EFFECT_CATEGORIES.map((item) => (
            <CategoryChip key={item.id} on={category === item.id} onClick={() => setCategory(item.id)} label={item.label} count={counts.get(item.id) ?? 0} title={item.hint} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un efecto: risa, campana, whoosh…" className="max-w-sm" aria-label="Buscar un efecto" />
          <p className="min-w-0 text-xs break-words text-muted">{search ? `${visible.length} resultados en todas las categorías` : (hint ?? "Todas las categorías")}</p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const adding = loading?.current?.id === item.id;
            return (
              <li key={item.id} className={cn("flex min-w-0 items-center gap-2 rounded-xl border p-2.5", playing === item.id ? "border-signal bg-signal-soft" : "border-line bg-surface")}>
                <Button size="icon" variant="secondary" className="size-8 shrink-0" onClick={() => toggle(item)} aria-label={playing === item.id ? `Detener ${item.title}` : `Escuchar ${item.title}`}>
                  {playing === item.id ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
                </Button>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-medium break-words" title={item.title}>
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {!category || search ? `${EFFECT_LABELS.get(item.category)} · ` : ""}
                    {effectLength(item.seconds)}
                  </span>
                </span>
                {inBank(pads, item) ? (
                  <Badge tone="onair" className="shrink-0">
                    <Check className="size-3" /> En la botonera
                  </Badge>
                ) : pending.has(item.id) ? (
                  <Badge tone={adding ? "signal" : "neutral"} className="shrink-0">
                    {adding ? "Agregando…" : "En cola"}
                  </Badge>
                ) : (
                  <Button size="sm" variant="ghost" className="shrink-0" disabled={free <= 0} onClick={() => bank.load([item])} title={free <= 0 ? `La botonera tiene hasta ${max} botones` : undefined}>
                    + Botonera
                  </Button>
                )}
              </li>
            );
          })}
          {!visible.length ? <li className="col-span-full py-8 text-center text-sm text-muted">No hay efectos con ese nombre.</li> : null}
        </ul>

        {report ? <p className={cn("rounded-lg px-3 py-2 text-sm break-words", report.tone === "error" ? "bg-danger-soft text-danger" : "bg-onair-soft text-onair")}>{report.text}</p> : null}
      </div>
    </Modal>
  );
}

/** Progress of the effects loading in the background, with the way to stop it. */
export function PadLoadingBar({ bank, className }: { bank: PadsApi; className?: string }) {
  const { loading } = bank;
  if (!loading) return null;
  const step = Math.min(loading.done + 1, loading.total);
  return (
    <div className={cn("space-y-1.5 rounded-lg border border-onair/30 bg-onair-soft px-2.5 py-2", className)} role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-muted">
          <span className="font-semibold text-onair">
            Cargando efectos · {step} de {loading.total}
          </span>
          {loading.current ? ` · ${loading.current.title}` : ""}
        </p>
        <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-[11px] text-danger" disabled={loading.stopping} onClick={bank.stop}>
          {loading.stopping ? "Deteniendo…" : "Detener"}
        </Button>
      </div>
      <span className="block h-1 overflow-hidden rounded-full bg-surface" aria-hidden>
        <span className="block h-full rounded-full bg-onair transition-[width]" style={{ width: `${(loading.done / Math.max(1, loading.total)) * 100}%` }} />
      </span>
    </div>
  );
}

export function CategoryChip({ on, onClick, label, count, title, small = false }: { on: boolean; onClick: () => void; label: string; count: number; title?: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={cn("inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-lg border font-medium transition", small ? "h-6 px-2 text-[10px]" : "h-8 px-3 text-xs", on ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:text-ink")}
    >
      <span className="truncate">{label}</span>
      <span className={cn("tabular", on ? "text-canvas/70" : "text-faint")}>{count}</span>
    </button>
  );
}
