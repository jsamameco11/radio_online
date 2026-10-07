import { Check, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { cn } from "@/lib/cn";
import { http, HttpError } from "@/lib/http";
import { EFFECT_CATEGORIES, FACTORY_EFFECTS, STARTER_EFFECTS, effectBuffer, previewEffect, stopPreview, wavFile, type FactoryEffect } from "@/lib/radio/effects";
import type { BroadcastTrack } from "@/types/studio";
import type { ConsoleApi } from "./use-console";

/** Artist the server gives every factory effect it stores (see App\Domain\Studio\Actions\AddFactoryEffect). */
const ARTIST = "Efectos de fábrica";

const LABELS = new Map(EFFECT_CATEGORIES.map((category) => [category.id, category.label]));

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const inBank = (pads: BroadcastTrack[], item: FactoryEffect) => pads.some((pad) => pad.kind === "effect" && pad.title === item.title && pad.artist === `${ARTIST} · ${LABELS.get(item.category)}`);

const length = (seconds: number) => `${seconds.toFixed(seconds < 10 ? 1 : 0).replace(".", ",")} s`;

/**
 * The factory effects: categorized, heard here (only by the operator) before adding them, and
 * added to the pad bank one by one or as the basic set. Each one becomes a library audio.
 */
export function EffectsLibrary({ api, pads, max, onClose, onPads }: { api: ConsoleApi; pads: BroadcastTrack[]; max: number; onClose: () => void; onPads: (pads: BroadcastTrack[]) => void }) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [report, setReport] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    FACTORY_EFFECTS.forEach((item) => map.set(item.category, (map.get(item.category) ?? 0) + 1));
    return map;
  }, []);
  const search = fold(query.trim());
  const visible = FACTORY_EFFECTS.filter((item) => (search ? fold(`${item.title} ${LABELS.get(item.category)}`).includes(search) : !category || item.category === category));
  const starter = STARTER_EFFECTS.map((id) => FACTORY_EFFECTS.find((item) => item.id === id)).filter((item): item is FactoryEffect => item !== undefined && !inBank(pads, item));
  const free = max - pads.length;

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

  /** Renders each effect here, uploads it as a WAV and puts it at the end of the pad bank, one after the other. */
  async function load(items: FactoryEffect[]) {
    let bank = pads;
    let added = 0;
    setReport(null);
    for (const item of items.slice(0, Math.max(0, max - bank.length))) {
      setAdding(item.id);
      try {
        const buffer = await effectBuffer(item);
        const body = new FormData();
        body.set("title", item.title);
        body.set("category", LABELS.get(item.category) ?? item.category);
        body.set("duration", buffer.duration.toFixed(2));
        body.set("audio", wavFile(buffer, `${item.id}.wav`));
        const data = await http.post<{ pads: BroadcastTrack[] }>(`${api.base}/botonera/efectos`, body);
        bank = data.pads;
        added += 1;
        onPads(bank);
      } catch (error) {
        setReport({ tone: "error", text: error instanceof HttpError ? error.firstError() : `No se pudo agregar «${item.title}». Revisa tu conexión e inténtalo de nuevo.` });
        break;
      }
    }
    setAdding(null);
    if (added) setReport((value) => value ?? { tone: "info", text: added === 1 ? "Efecto agregado a la botonera." : `Listo: ${added} efectos nuevos en la botonera.` });
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
      description={`${FACTORY_EFFECTS.length} sonidos en ${EFFECT_CATEGORIES.length} categorías. Escúchalos aquí (solo tú) y agrégalos a la botonera. Botonera: ${pads.length}/${max}.`}
      footer={
        <Button onClick={close} disabled={adding !== null}>
          Listo
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-raised p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Botonera básica</p>
            <p className="text-xs text-muted">Aplausos, redoble, ta-dá, risas, whoosh, campana, jingle y más: {STARTER_EFFECTS.length} efectos listos para hacer radio.</p>
          </div>
          <Button size="sm" variant="signal" disabled={!starter.length || free <= 0} loading={adding !== null && starter.some((item) => item.id === adding)} onClick={() => void load(starter)}>
            {starter.length ? "Cargar botonera básica" : "Ya está cargada"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <CategoryChip on={!category} onClick={() => setCategory("")} label="Todos" count={FACTORY_EFFECTS.length} />
          {EFFECT_CATEGORIES.map((item) => (
            <CategoryChip key={item.id} on={category === item.id} onClick={() => setCategory(item.id)} label={item.label} count={counts.get(item.id) ?? 0} title={item.hint} />
          ))}
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un efecto: risa, campana, whoosh…" className="max-w-sm" aria-label="Buscar un efecto" />

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id} className={cn("flex items-center gap-2 rounded-xl border p-2.5", playing === item.id ? "border-signal bg-signal-soft" : "border-line bg-surface")}>
              <Button size="icon" variant="secondary" className="size-8" onClick={() => toggle(item)} aria-label={playing === item.id ? `Detener ${item.title}` : `Escuchar ${item.title}`}>
                {playing === item.id ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
              </Button>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-medium" title={item.title}>
                  {item.title}
                </span>
                <span className="block truncate text-xs text-muted">
                  {!category || search ? `${LABELS.get(item.category)} · ` : ""}
                  {length(item.seconds)}
                </span>
              </span>
              {inBank(pads, item) ? (
                <Badge tone="onair">
                  <Check className="size-3" /> En la botonera
                </Badge>
              ) : (
                <Button size="sm" variant="ghost" disabled={free <= 0 || adding !== null} loading={adding === item.id} onClick={() => void load([item])}>
                  + Botonera
                </Button>
              )}
            </li>
          ))}
          {!visible.length ? <li className="col-span-full py-8 text-center text-sm text-muted">No hay efectos con ese nombre.</li> : null}
        </ul>

        {report ? <p className={cn("rounded-lg px-3 py-2 text-sm", report.tone === "error" ? "bg-danger-soft text-danger" : "bg-onair-soft text-onair")}>{report.text}</p> : null}
        <p className="text-xs text-muted">{free > 0 ? `Quedan ${free} botones libres.` : "Botonera llena: quita botones con «Editar» para sumar otros."} Cada efecto queda también en la biblioteca.</p>
      </div>
    </Modal>
  );
}

function CategoryChip({ on, onClick, label, count, title }: { on: boolean; onClick: () => void; label: string; count: number; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={on} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition", on ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:text-ink")}>
      {label}
      <span className="text-faint tabular">{count}</span>
    </button>
  );
}
