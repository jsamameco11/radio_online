import { router } from "@inertiajs/react";
import { AudioLines, Headphones, Pause, Play, Redo2, RotateCcw, Save, Scissors, SquareDashed, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Switch } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { duration as formatDuration } from "@/lib/format";
import { http, HttpError } from "@/lib/http";
import { PreviewEngine } from "@/lib/media/editor/engine";
import { type Cut, type Recipe, editedLength, fromSaved, mergeCuts, preciseTime, restoreRange, sameRecipe, serverOnly, toEdited } from "@/lib/media/editor/recipe";
import type { EditorAnalysis, EditorLimits, EditorTrack } from "@/types/media";
import { SoundPanel } from "./sound-panel";
import { Waveform } from "./waveform";

interface Props {
  track: EditorTrack;
  available: boolean;
  limits: EditorLimits;
}

const ZOOMS = [1, 2, 4, 8, 16, 32, 64];
const POLL_MS = 3000;

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
}

/** Undo/redo history of the recipe. */
type History = { past: Recipe[]; present: Recipe; future: Recipe[] };
type HistoryAction = { type: "set"; recipe: Recipe } | { type: "undo" } | { type: "redo" } | { type: "reset"; recipe: Recipe };

function history(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "set":
      return sameRecipe(state.present, action.recipe) && state.present.preset === action.recipe.preset ? state : { past: [...state.past.slice(-99), state.present], present: action.recipe, future: [] };
    case "undo":
      return state.past.length ? { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] } : state;
    case "redo":
      return state.future.length ? { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) } : state;
    case "reset":
      return { past: [], present: action.recipe, future: [] };
  }
}

/** Editing one audio: waveform with cuts and selection, fades, sound treatment, live preview, final sample and save. */
export function EditorWorkspace({ track, available, limits }: Props) {
  const url = useStudioUrl();
  const duration = track.source_duration;
  const saved = useMemo(() => fromSaved(track.edit, duration), [track.edit, duration]);
  const [{ present: recipe, past, future }, dispatch] = useReducer(history, { past: [], present: saved, future: [] });
  const setRecipe = useCallback((next: Recipe) => dispatch({ type: "set", recipe: next }), []);

  const [analysis, setAnalysis] = useState<EditorAnalysis | null>(null);
  const [analysisState, setAnalysisState] = useState<"loading" | "ready" | "missing">("loading");
  const [selection, setSelection] = useState<Cut | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewStart, setViewStart] = useState(0);
  const [time, setTime] = useState(0);
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const [bypass, setBypass] = useState(false);
  const [tab, setTab] = useState<"cortes" | "sonido">("cortes");
  const [status, setStatus] = useState<{ value: EditorTrack["edit_status"]; error: string | null }>({ value: track.edit_status, error: track.edit_error });
  const [busy, setBusy] = useState<"save" | "restore" | "sample" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const engine = useRef<PreviewEngine | null>(null);
  const sample = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const preview = track.source_url ? new PreviewEngine(track.source_url, duration, saved, rerender) : null;
    engine.current = preview;
    return () => {
      preview?.destroy();
      engine.current = null;
    };
  }, [track.source_url, duration, saved]);

  useEffect(() => {
    engine.current?.setRecipe(recipe);
  }, [recipe]);

  useEffect(() => {
    engine.current?.setBypass(bypass);
  }, [bypass]);

  useEffect(() => dispatch({ type: "reset", recipe: saved }), [saved]);

  const analysisUrl = url(`/editor/${track.id}/analisis`);
  const statusUrl = url(`/editor/${track.id}/estado`);

  useEffect(() => {
    let cancelled = false;
    setAnalysisState("loading");
    http
      .get<{ analysis: EditorAnalysis | null }>(analysisUrl)
      .then(({ analysis: found }) => {
        if (cancelled) return;
        setAnalysis(found);
        setAnalysisState(found ? "ready" : "missing");
        engine.current?.setLoudness(found?.loudness ?? null);
      })
      .catch(() => !cancelled && setAnalysisState("missing"));
    return () => {
      cancelled = true;
    };
  }, [analysisUrl]);

  const peaks = useMemo(() => {
    if (!analysis?.peaks) return null;
    const raw = atob(analysis.peaks);
    const bytes = new Int8Array(raw.length);
    for (let index = 0; index < raw.length; index++) bytes[index] = (raw.charCodeAt(index) << 24) >> 24;
    return bytes;
  }, [analysis]);

  const playing = engine.current?.playing ?? false;
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      setTime(engine.current?.time ?? 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    if (status.value !== "processing") return;
    const timer = window.setInterval(async () => {
      const response = await http.get<{ track: EditorTrack }>(statusUrl).catch(() => null);
      if (!response || response.track.edit_status === "processing") return;
      setStatus({ value: response.track.edit_status, error: response.track.edit_error });
      if (response.track.edit_status === null) {
        setMessage("Listo: el audio editado ya suena en la radio.");
        router.reload({ only: ["track", "tracks"] });
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [status.value, statusUrl]);

  useEffect(() => () => sample.current?.pause(), []);

  const span = duration / zoom;
  const start = Math.max(0, Math.min(viewStart, duration - span));
  const view: Cut = [start, start + span];
  const length = editedLength(recipe, duration);
  const dirty = !sameRecipe(recipe, saved);
  const tooShort = length < limits.min_length;
  const tooManyCuts = recipe.cuts.length > limits.max_cuts;
  const processing = status.value === "processing";

  const changeZoom = (next: number) => {
    const center = time >= view[0] && time <= view[1] ? time : view[0] + span / 2;
    setZoom(next);
    setViewStart(Math.max(0, center - duration / next / 2));
  };

  const togglePlay = () => {
    const preview = engine.current;
    if (!preview) return;
    sample.current?.pause();
    if (preview.playing) preview.pause();
    else {
      preview.setLoop(null);
      void preview.play(time);
    }
  };

  const seek = (at: number) => {
    setTime(at);
    engine.current?.seek(at);
  };

  const cutSelection = () => {
    if (!selection) return;
    setRecipe({ ...recipe, cuts: mergeCuts([...recipe.cuts, selection], duration) });
    setSelection(null);
  };

  const keepSelection = () => {
    if (!selection) return;
    setRecipe({ ...recipe, cuts: mergeCuts([...recipe.cuts, [0, selection[0]], [selection[1], duration]], duration) });
    setSelection(null);
  };

  const restoreSelection = () => {
    if (!selection) return;
    setRecipe({ ...recipe, cuts: restoreRange(recipe.cuts, selection, duration) });
    setSelection(null);
  };

  const listenSelection = () => {
    const preview = engine.current;
    if (!selection || !preview) return;
    sample.current?.pause();
    preview.setLoop(selection);
    void preview.play(selection[0]);
  };

  const playSample = async () => {
    engine.current?.pause();
    sample.current?.pause();
    setBusy("sample");
    setMessage(null);
    try {
      const response = await fetch(url(`/editor/${track.id}/muestra`), {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "audio/mpeg, application/json", "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrfToken() },
        body: JSON.stringify({ recipe, at: Math.max(0, Math.min(length - 1, toEdited(time, recipe, duration))) }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new HttpError(response.status, body);
      }
      const audio = new Audio(URL.createObjectURL(await response.blob()));
      audio.onended = () => URL.revokeObjectURL(audio.src);
      sample.current = audio;
      await audio.play();
    } catch (error) {
      setMessage(error instanceof HttpError ? error.firstError() : "No se pudo preparar la muestra.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setMessage(null);
    try {
      const { track: updated } = await http.post<{ track: EditorTrack }>(url(`/editor/${track.id}`), { recipe });
      setStatus({ value: updated.edit_status, error: updated.edit_error });
      if (updated.edit_status === "processing") setMessage("Estamos procesando el audio. Puedes seguir trabajando; te avisaremos al terminar.");
      else router.reload({ only: ["track", "tracks"] });
    } catch (error) {
      setMessage(error instanceof HttpError ? error.firstError() : "No se pudo guardar la edición.");
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!window.confirm("¿Volver al audio original? Se pierden los cortes y el tratamiento guardados.")) return;
    setBusy("restore");
    setMessage(null);
    try {
      await http.post(url(`/editor/${track.id}/restaurar`));
      router.reload({ only: ["track", "tracks"] });
    } catch (error) {
      setMessage(error instanceof HttpError ? error.firstError() : "No se pudo restaurar el original.");
    } finally {
      setBusy(null);
    }
  };

  const onServer = serverOnly(recipe);

  return (
    <div className="space-y-6">
      {!available && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          El procesador de audio no está disponible en este momento. Puedes preparar y escuchar la edición, pero no guardarla.
        </p>
      )}
      {processing && <p className="rounded-xl bg-info-soft px-4 py-3 text-sm text-info">Procesando el audio editado… esto puede tardar unos minutos en audios largos.</p>}
      {status.value === "failed" && status.error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{status.error}</p>}
      {message && <p className="rounded-xl bg-raised px-4 py-3 text-sm">{message}</p>}

      <Panel
        title={track.title}
        description={[track.credit, track.kind, `Original ${formatDuration(duration)}`, `Editado ${formatDuration(length)}`].filter(Boolean).join(" · ")}
        actions={
          <>
            {track.edited && <Badge tone="signal">Editado</Badge>}
            <Button size="icon" variant="ghost" aria-label="Deshacer" disabled={past.length === 0} onClick={() => dispatch({ type: "undo" })}>
              <Undo2 className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Rehacer" disabled={future.length === 0} onClick={() => dispatch({ type: "redo" })}>
              <Redo2 className="size-4" />
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {analysisState === "missing" && <p className="text-xs text-muted">No pudimos dibujar la forma de onda; igual puedes escuchar, seleccionar y cortar.</p>}
          <Waveform
            peaks={peaks}
            perSecond={analysis?.perSecond ?? 1}
            duration={duration}
            view={view}
            cuts={recipe.cuts}
            selection={selection}
            playhead={time}
            fadeIn={recipe.fadeIn}
            fadeOut={recipe.fadeOut}
            onSeek={seek}
            onSelect={setSelection}
          />
          {zoom > 1 && (
            <input
              type="range"
              min={0}
              max={Math.max(0, duration - span)}
              step={span / 100}
              value={start}
              onChange={(event) => setViewStart(Number(event.target.value))}
              className="w-full accent-[var(--signal)]"
              aria-label="Desplazar la vista"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="signal" size="icon" aria-label={playing ? "Pausar" : "Reproducir"} onClick={togglePlay} disabled={!engine.current || engine.current.broken}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <span className="w-32 font-mono text-sm tabular">
              {preciseTime(time)} / {preciseTime(duration)}
            </span>
            <Button size="icon" variant="ghost" aria-label="Alejar" disabled={zoom === ZOOMS[0]} onClick={() => changeZoom(ZOOMS[ZOOMS.indexOf(zoom) - 1])}>
              <ZoomOut className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Acercar" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => changeZoom(ZOOMS[ZOOMS.indexOf(zoom) + 1])}>
              <ZoomIn className="size-4" />
            </Button>
            <div className="ml-auto flex items-center gap-3">
              <Switch checked={bypass} onChange={setBypass} label="Escuchar sin tratamiento" />
            </div>
          </div>

          {selection && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
              <span className="text-muted">
                Selección {preciseTime(selection[0])} – {preciseTime(selection[1])}
              </span>
              <Button size="sm" variant="ghost" icon={<Headphones className="size-3.5" />} onClick={listenSelection}>
                Escuchar
              </Button>
              <Button size="sm" variant="danger" icon={<Scissors className="size-3.5" />} onClick={cutSelection}>
                Cortar
              </Button>
              <Button size="sm" variant="secondary" icon={<SquareDashed className="size-3.5" />} onClick={keepSelection}>
                Conservar solo esto
              </Button>
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={restoreSelection}>
                Devolver lo cortado
              </Button>
            </div>
          )}
        </div>
      </Panel>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "cortes", label: "Cortes y fundidos", count: recipe.cuts.length },
          { value: "sonido", label: "Sonido" },
        ]}
      />

      {tab === "cortes" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Fundidos" description="Entrada y salida suaves, y cruce entre las partes que quedan.">
            <div className="space-y-4">
              {(
                [
                  ["fadeIn", "Entrada", limits.max_fade],
                  ["fadeOut", "Salida", limits.max_fade],
                  ["join", "Cruce en los cortes", limits.max_join],
                ] as const
              ).map(([key, label, max]) => (
                <label key={key} className="block space-y-1">
                  <span className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted tabular">{recipe[key].toFixed(1)} s</span>
                  </span>
                  <input type="range" min={0} max={max} step={0.1} value={recipe[key]} onChange={(event) => setRecipe({ ...recipe, [key]: Number(event.target.value) })} className="w-full accent-[var(--signal)]" />
                </label>
              ))}
            </div>
          </Panel>
          <Panel title="Cortes" description="Arrastra sobre la onda para seleccionar y pulsa «Cortar»." padded={false}>
            {recipe.cuts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Todavía no hay cortes.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                {recipe.cuts.map((cut, index) => (
                  <li key={`${cut[0]}-${cut[1]}`} className="flex items-center gap-3 px-5 py-2 text-sm">
                    <span className="w-6 text-xs text-faint">{index + 1}</span>
                    <button type="button" className="flex-1 text-left font-mono tabular hover:text-signal" onClick={() => setSelection(cut)}>
                      {preciseTime(cut[0])} – {preciseTime(cut[1])}
                    </button>
                    <span className="text-xs text-muted">{(cut[1] - cut[0]).toFixed(1)} s</span>
                    <Button size="sm" variant="ghost" onClick={() => setRecipe({ ...recipe, cuts: recipe.cuts.filter((_, other) => other !== index) })}>
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {tooManyCuts && <p className="px-5 pb-4 text-xs text-danger">Hay más de {limits.max_cuts} cortes; une algunos para poder guardar.</p>}
          </Panel>
        </div>
      ) : (
        <Panel>
          <SoundPanel recipe={recipe} maxGain={limits.max_gain} onChange={setRecipe} />
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-line bg-surface px-5 py-4">
        {onServer.length > 0 && <p className="mr-auto text-xs text-muted">La {onServer.join(" y la ")} se escucha en la muestra final.</p>}
        {tooShort && <p className="mr-auto text-xs text-danger">La edición deja el audio demasiado corto.</p>}
        {track.edited && (
          <Button variant="ghost" icon={<RotateCcw className="size-4" />} loading={busy === "restore"} disabled={processing || busy !== null} onClick={restore}>
            Volver al original
          </Button>
        )}
        <Button variant="secondary" icon={<AudioLines className="size-4" />} loading={busy === "sample"} disabled={!available || tooShort || busy !== null} onClick={playSample}>
          Muestra final ({limits.preview_seconds} s)
        </Button>
        <Button
          icon={<Save className="size-4" />}
          loading={busy === "save"}
          disabled={!available || processing || tooShort || tooManyCuts || busy !== null || !dirty}
          onClick={save}
        >
          Guardar edición
        </Button>
      </div>
    </div>
  );
}
