import { Link } from "@inertiajs/react";
import { ArrowDown, ArrowDownRight, ArrowUp, PanelRightClose, Pencil, Sparkles, Square, Volume1, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack, TrackKind } from "@/types/studio";
import { useSoundDrop } from "./drag";
import { EffectsLibrary, PadLoadingBar, fold } from "./effects-library";
import { KIND_LABEL } from "./labels";
import type { ConsoleApi } from "./use-console";
import { starterEffects, type PadsApi } from "./use-pads";
import type { Sounds } from "./use-sounds";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/**
 * The pad bank: effects and jingles that fire at once for every listener (keys 1–0 too). Sounds
 * dropped on it join the bank; «Editar» chooses and orders them, «Efectos» opens the factory ones.
 */
export function PadBank({ api, bank, sounds, onAdd, onCollapse }: { api: ConsoleApi; bank: PadsApi; sounds: Sounds; onAdd: (track: BroadcastTrack) => void; onCollapse?: () => void }) {
  const { now, firePad, warmPads } = api;
  const { pads, loading, report, max } = bank;
  const [picking, setPicking] = useState(false);
  const [effects, setEffects] = useState(false);
  const [fired, setFired] = useState<string | null>(null);
  const drop = useSoundDrop(sounds, onAdd);
  const sounding = api.snapshot.radio.layers.filter((layer) => layer.lane === "pad" && layer.start <= now && now < layer.end);

  function fire(track: BroadcastTrack) {
    setFired(track.id);
    window.setTimeout(() => setFired((value) => (value === track.id ? null : value)), 650);
    void firePad(track);
  }

  useEffect(() => warmPads(pads), [pads, warmPads]);

  useEffect(() => {
    if (picking || effects) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.ctrlKey || event.metaKey || event.altKey || target.closest("input, textarea, select, [contenteditable], dialog")) return;
      const pad = pads[KEYS.indexOf(event.key)];
      if (!pad?.src) return;
      event.preventDefault();
      fire(pad);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div {...drop} className="h-full rounded-xl data-drop:ring-2 data-drop:ring-royal/60">
      <Panel
        dense
        className="h-full"
        title={
          <span className="inline-flex items-center gap-2">
            Botonera
            <span className="font-mono text-[10px] font-medium text-faint tabular">
              {pads.length}/{max}
            </span>
          </span>
        }
        description="Teclas 1–0 · suelta un sonido aquí para agregarlo."
        actions={
          <>
            {onCollapse ? (
              <Button size="icon" variant="ghost" className="size-8" onClick={onCollapse} aria-label="Replegar la botonera" title="Replegar la botonera">
                <PanelRightClose className="size-3.5" />
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5" />} onClick={() => setEffects(true)} title="Efectos de fábrica por categoría">
              Efectos
            </Button>
            <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} disabled={loading !== null} onClick={() => setPicking(true)} title={loading ? "Espera a que terminen de cargarse los efectos" : "Elegir y ordenar los botones"}>
              Editar
            </Button>
            <Button size="icon" variant="ghost" className="size-8" disabled={!sounding.length} onClick={() => void api.stop({ lane: "pad" }, 1)} aria-label="Fundir la botonera" title="Funde los efectos que suenan">
              <ArrowDownRight className="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" disabled={!sounding.length} onClick={() => void api.stop({ lane: "pad" })} aria-label="Cortar la botonera" title="Corta todos los efectos que suenan">
              <Square className="size-3.5" />
            </Button>
          </>
        }
      >
        {!effects ? <PadLoadingBar bank={bank} className="mb-2" /> : null}
        {report && !effects && !loading ? (
          <div role="status" className={cn("mb-2 flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[11px]", report.tone === "error" ? "bg-danger-soft text-danger" : "bg-onair-soft text-onair")}>
            <p className="min-w-0 flex-1 break-words">{report.text}</p>
            <button type="button" onClick={bank.dismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        <div className="desk-rail -mx-3 max-h-[28rem] min-h-24 overflow-y-scroll overscroll-contain px-3 xl:max-h-[min(42rem,calc(100vh-16rem))]">
          {pads.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5 pr-1">
              {pads.map((pad, index) => {
                const playing = sounding.filter((layer) => layer.track_id === pad.id).at(-1);
                const lit = Boolean(playing) || fired === pad.id;
                return (
                  <button
                    key={pad.id}
                    type="button"
                    disabled={!pad.src}
                    onClick={() => fire(pad)}
                    title={`${pad.title} · ${duration(pad.duration)}`}
                    className={cn(
                      "relative flex h-20 w-full min-w-0 flex-col items-start justify-between overflow-hidden rounded-lg border p-2 text-left transition active:scale-[0.98] disabled:opacity-45",
                      lit ? "border-royal bg-royal text-white shadow-[0_8px_24px_-12px_var(--color-royal)]" : "border-royal/35 bg-royal-soft text-ink hover:border-royal/70",
                      fired === pad.id && "scale-[0.97]",
                    )}
                  >
                    <span className="flex w-full min-w-0 items-start justify-between gap-1">
                      <span className="line-clamp-2 min-w-0 text-[11px] leading-tight font-semibold break-words">{shortTitle(pad.title, 28)}</span>
                      {index < KEYS.length ? <kbd className={cn("shrink-0 font-mono text-[10px]", lit ? "text-white/70" : "text-faint")}>{KEYS[index]}</kbd> : null}
                    </span>
                    <span className={cn("flex w-full min-w-0 items-center gap-1 font-mono text-[9px] tracking-wide uppercase", lit ? "text-white/80" : "text-muted")}>
                      <span className="min-w-0 truncate">{playing ? `-${duration(Math.max(0, playing.end - now) / 1000)}` : `${pad.kind_label} · ${duration(pad.duration)}`}</span>
                      {pad.duck ? <Volume1 className="size-3 shrink-0" aria-label="Baja la música" /> : null}
                    </span>
                    {playing ? <span className="absolute bottom-0 left-0 h-0.5 bg-white/80" style={{ width: `${Math.min(100, ((now - playing.start) / Math.max(1, playing.end - playing.start)) * 100)}%` }} /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center">
              <p className="text-xs break-words text-muted">La botonera está vacía. Cárgala con efectos listos para hacer radio o elige los tuyos.</p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                <Button size="sm" variant="signal" disabled={loading !== null} onClick={() => bank.load(starterEffects())}>
                  {loading ? "Cargando…" : "Cargar botonera básica"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEffects(true)}>
                  Ver todos los efectos
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {picking ? <PadPicker api={api} bank={bank} library={sounds.library} onClose={() => setPicking(false)} /> : null}
      {effects ? <EffectsLibrary bank={bank} onClose={() => setEffects(false)} /> : null}
    </div>
  );
}

const FILTERS: { id: "" | TrackKind; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "effect", label: "Efectos" },
  { id: "jingle", label: "Jingles" },
  { id: "commercial", label: "Anuncios" },
  { id: "song", label: "Música" },
  { id: "program", label: "Programas" },
];

/** «Editar»: marks up to the bank's size of library audios, numbered in the order of the buttons. */
function PadPicker({ api, bank, library, onClose }: { api: ConsoleApi; bank: PadsApi; library: BroadcastTrack[]; onClose: () => void }) {
  const { max } = bank;
  const [selected, setSelected] = useState(bank.pads.map((track) => track.id));
  const [filter, setFilter] = useState<"" | TrackKind>("effect");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const byId = useMemo(() => new Map([...library, ...bank.pads].map((track) => [track.id, track])), [bank.pads, library]);
  const search = fold(query.trim());
  const visible = library.filter((track) => (!filter || track.kind === filter) && (!search || fold(`${track.title} ${track.artist ?? ""}`).includes(search)));

  function toggle(id: string) {
    if (selected.includes(id)) {
      setError("");
      setSelected(selected.filter((item) => item !== id));
    } else if (selected.length >= max) {
      setError(`La botonera tiene hasta ${max} botones.`);
    } else {
      setError("");
      setSelected([...selected, id]);
    }
  }

  function move(index: number, step: number) {
    setSelected((list) => {
      const target = index + step;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const result = await bank.save(selected);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Elegir los botones"
      description={`Marca hasta ${max} audios de la biblioteca. El orden de la derecha es el de los botones (teclas 1–0).`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            Guardar botonera
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de audio">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn("h-7 rounded-lg border px-2.5 text-xs font-medium", filter === item.id ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:text-ink")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre…" aria-label="Buscar en la biblioteca" />
          <ul className="desk-scroll max-h-80 min-h-0 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1">
            {visible.length ? (
              visible.map((track) => {
                const position = selected.indexOf(track.id);
                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      onClick={() => toggle(track.id)}
                      aria-pressed={position >= 0}
                      className={cn("flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", position >= 0 ? "bg-royal-soft text-ink" : "hover:bg-raised")}
                    >
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[10px]", position >= 0 ? "border-royal bg-royal text-white" : "border-line-strong")}>{position >= 0 ? position + 1 : ""}</span>
                      <span className="min-w-0 flex-1 truncate">{track.title}</span>
                      <span className="shrink-0 text-[11px] text-muted">
                        {KIND_LABEL[track.kind]} · {duration(track.duration)}
                      </span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-6 text-center text-sm text-muted">
                No hay audios con ese filtro.{" "}
                <Link href={api.url("/biblioteca")} className="font-medium text-ink underline">
                  Súbelos en la Biblioteca
                </Link>
                .
              </li>
            )}
          </ul>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <p className="text-xs font-semibold text-muted">
            En la botonera ({selected.length}/{max})
          </p>
          <ol className="desk-scroll max-h-96 min-h-0 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1">
            {selected.map((id, index) => {
              const track = byId.get(id);
              if (!track) return null;
              return (
                <li key={id} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm">
                  <span className="w-5 shrink-0 text-right font-mono text-[11px] text-faint">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{shortTitle(track.title, 32)}</span>
                  <Button size="icon" variant="ghost" className="size-6" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir «${track.title}»`}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-6" disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar «${track.title}»`}>
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => toggle(id)} aria-label={`Quitar «${track.title}»`}>
                    <X className="size-3.5" />
                  </Button>
                </li>
              );
            })}
            {!selected.length ? <li className="px-3 py-6 text-center text-sm text-muted">Aún no elegiste ninguno.</li> : null}
          </ol>
        </div>
      </div>
      {error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
    </Modal>
  );
}
