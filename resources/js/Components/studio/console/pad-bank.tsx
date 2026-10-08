import { router } from "@inertiajs/react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Sparkles, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { http, HttpError } from "@/lib/http";
import { shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack } from "@/types/studio";
import { EffectsLibrary } from "./effects-library";
import { TrackPicker } from "./track-picker";
import type { ConsoleApi } from "./use-console";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/**
 * The pad bank: effects and jingles that fire at once for every listener (keys 1–0 too). In edit
 * mode the operator adds, removes and reorders them; factory effects come from the effects library.
 */
export function PadBank({ api, initial, library, max }: { api: ConsoleApi; initial: BroadcastTrack[]; library: BroadcastTrack[]; max: number }) {
  const [pads, setPads] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState("");
  const [effects, setEffects] = useState(false);
  const [saving, setSaving] = useState(false);
  const { now } = api;
  const sounding = new Set(api.snapshot.radio.layers.filter((layer) => layer.lane === "pad" && layer.start <= now && now < layer.end).map((layer) => layer.track_id));
  const { firePad, warmPads } = api;

  useEffect(() => warmPads(pads), [pads, warmPads]);

  useEffect(() => {
    if (editing) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.ctrlKey || event.metaKey || event.altKey || target.closest("input, textarea, select, [contenteditable]")) return;
      const pad = pads[KEYS.indexOf(event.key)];
      if (!pad) return;
      event.preventDefault();
      void firePad(pad);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, firePad, pads]);

  async function save(next: BroadcastTrack[]) {
    setSaving(true);
    try {
      const data = await http.put<{ message: string; pads: BroadcastTrack[] }>(`${api.base}/botonera`, { tracks: next.map((pad) => pad.id) });
      setPads(data.pads);
    } catch (error) {
      api.setNotice({ tone: "error", text: error instanceof HttpError ? error.firstError() : "No pudimos guardar la botonera." });
    }
    setSaving(false);
  }

  function move(index: number, step: number) {
    const next = [...pads];
    const [pad] = next.splice(index, 1);
    next.splice(index + step, 0, pad);
    void save(next);
  }

  function add() {
    const track = library.find((item) => item.id === adding);
    if (!track || pads.some((pad) => pad.id === track.id)) return;
    setAdding("");
    void save([...pads, track]);
  }

  return (
    <Panel
      title="Botonera"
      description={editing ? "Ordena, quita o agrega botones." : "Toca un botón o usa las teclas 1 a 0."}
      actions={
        <>
          <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5" />} onClick={() => setEffects(true)}>
            Efectos
          </Button>
          <Button size="sm" variant={editing ? "primary" : "secondary"} icon={<Pencil className="size-3.5" />} onClick={() => setEditing(!editing)} loading={saving}>
            {editing ? "Listo" : "Editar"}
          </Button>
          <Button size="sm" variant="ghost" icon={<Square className="size-3.5" />} onClick={() => void api.stop({ lane: "pad" })} title="Corta todos los efectos que suenan">
            Cortar
          </Button>
        </>
      }
    >
      {pads.length === 0 ? (
        <p className="text-sm text-muted">La botonera está vacía. Agrega efectos de fábrica o audios de tu biblioteca con «Editar».</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {pads.map((pad, index) => (
            <div key={pad.id} className="relative">
              <button
                type="button"
                disabled={editing || !pad.src}
                onClick={() => void firePad(pad)}
                title={`${pad.title} · ${duration(pad.duration)}`}
                className={cn(
                  "flex h-24 w-full flex-col items-start justify-between rounded-xl border p-2.5 text-left transition active:scale-[0.98] disabled:cursor-default",
                  sounding.has(pad.id) ? "border-royal bg-royal text-white shadow-[0_8px_24px_-12px_var(--color-royal)]" : "border-royal/35 bg-royal-soft text-ink hover:border-royal/70",
                )}
              >
                <span className={cn("font-mono text-[10px]", sounding.has(pad.id) ? "text-white/70" : "text-faint")}>{KEYS[index] ?? ""}</span>
                <span className="line-clamp-2 text-xs font-semibold">{shortTitle(pad.title, 28)}</span>
                <span className={cn("font-mono text-[10px] tracking-wide uppercase", sounding.has(pad.id) ? "text-white/75" : "text-muted")}>
                  {pad.kind_label} · {duration(pad.duration)}
                </span>
              </button>
              {editing ? (
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <Button size="icon" variant="ghost" className="size-6" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Mover «${pad.title}» a la izquierda`}>
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => void save(pads.filter((item) => item.id !== pad.id))} aria-label={`Quitar «${pad.title}»`}>
                    <X className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-6" disabled={index === pads.length - 1} onClick={() => move(index, 1)} aria-label={`Mover «${pad.title}» a la derecha`}>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className="mt-4 flex gap-2">
          <TrackPicker library={library} value={adding} onChange={setAdding} kinds={["effect", "jingle", "commercial", "song", "program"]} placeholder="Agregar un audio de la biblioteca…" className="h-9 min-w-0 flex-1" label="Audio para la botonera" />
          <Button size="sm" icon={<Plus className="size-3.5" />} disabled={!adding || pads.length >= max} onClick={add}>
            Agregar
          </Button>
        </div>
      ) : null}

      {effects ? (
        <EffectsLibrary
          api={api}
          pads={pads}
          max={max}
          onClose={() => setEffects(false)}
          onPads={(next) => {
            setPads(next);
            router.reload({ only: ["library"] });
          }}
        />
      ) : null}
    </Panel>
  );
}
