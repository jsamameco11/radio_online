import { router } from "@inertiajs/react";
import { Headphones, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Panel } from "@/Components/ui/panel";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { http, HttpError } from "@/lib/http";
import { describeSound } from "@/lib/media/editor/describe";
import { PreviewEngine } from "@/lib/media/editor/engine";
import { cutAt, editedLength, fromSaved, isPlain, joins, keeps, mergeCuts, restoreRange, sameRecipe, serverOnly, toEdited, toSource, type Cut } from "@/lib/media/editor/recipe";
import type { EditorAnalysis, EditorLimits, EditorTrack } from "@/types/media";
import { AudioHeader } from "./audio-header";
import { LeaveDialog, RestoreDialog, SaveDialog } from "./confirm-dialogs";
import { EditActions } from "./edit-actions";
import { GuideDialog } from "./guide-dialog";
import { PartsList } from "./parts-list";
import { SamplePanel } from "./sample-panel";
import { SaveBar } from "./save-bar";
import { SoundPanel } from "./sound-panel";
import { Transport } from "./transport";
import { useEditorKeys } from "./use-editor-keys";
import { useRecipeHistory } from "./use-recipe-history";
import { useUnsavedGuard } from "./use-unsaved-guard";
import { MAX_PIXELS_PER_SECOND, Waveform } from "./waveform";

interface Props {
  track: EditorTrack;
  available: boolean;
  limits: EditorLimits;
}

const POLL_MS = 2500;
const SILENT: [number, number] = [-60, -60];

type Analysis = { perSecond: number; peaks: Int8Array; loudness: number | null };

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
}

function decode(analysis: EditorAnalysis): Analysis {
  const raw = atob(analysis.peaks);
  const peaks = new Int8Array(raw.length);
  for (let index = 0; index < raw.length; index++) peaks[index] = (raw.charCodeAt(index) << 24) >> 24;
  return { perSecond: analysis.perSecond, peaks, loudness: analysis.loudness };
}

/** Editing one audio: timeline with cuts and fades, sound treatment heard live, final sample and save. */
export function EditorWorkspace({ track, available, limits }: Props) {
  const url = useStudioUrl();
  const total = track.source_duration;
  const baseline = useMemo(() => fromSaved(track.edit, total), [track.edit, total]);
  const { recipe, change, undo, redo, canUndo, canRedo } = useRecipeHistory(baseline);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Cut | null>(null);
  const [zoom, setZoom] = useState(1);
  const [bypass, setBypass] = useState(false);
  const [loop, setLoop] = useState(false);
  const [time, setTime] = useState(0);
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState({ value: track.edit_status, error: track.edit_error });
  const [confirming, setConfirming] = useState<"save" | "restore" | null>(null);
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<{ url: string; at: number } | null>(null);
  const [sampling, setSampling] = useState(false);
  const engine = useRef<PreviewEngine | null>(null);
  const recipeRef = useRef(recipe);
  useEffect(() => {
    recipeRef.current = recipe;
  }, [recipe]);

  const length = editedLength(recipe, total);
  const dirty = !sameRecipe(recipe, baseline);
  const processing = status.value === "processing";
  const playing = engine.current?.playing ?? false;
  const broken = track.source_url === null || (engine.current?.broken ?? false);
  const overlapsCut = selection ? recipe.cuts.some(([from, to]) => from < selection[1] && to > selection[0]) : false;
  const { blocked, stay, proceed, allow } = useUnsavedGuard(dirty && !processing);
  const fades = useMemo(() => {
    const kept = keeps(recipe.cuts, total);
    const edited = editedLength(recipe, total);
    return {
      in: recipe.fadeIn > 0 && kept.length ? ([kept[0][0], toSource(recipe.fadeIn, recipe, total)] as Cut) : null,
      out: recipe.fadeOut > 0 && kept.length ? ([toSource(edited - recipe.fadeOut, recipe, total), kept[kept.length - 1][1]] as Cut) : null,
    };
  }, [recipe, total]);

  useEffect(() => {
    const preview = track.source_url ? new PreviewEngine(track.source_url, total, recipeRef.current, rerender) : null;
    engine.current = preview;
    return () => {
      preview?.destroy();
      engine.current = null;
    };
  }, [track.source_url, total]);

  useEffect(() => engine.current?.setRecipe(recipe), [recipe]);
  useEffect(() => engine.current?.setLoudness(analysis?.loudness ?? null), [analysis]);
  useEffect(() => engine.current?.setBypass(bypass), [bypass]);
  useEffect(() => engine.current?.setLoop(loop ? selection : null), [loop, selection]);

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
    let cancelled = false;
    http
      .get<{ analysis: EditorAnalysis | null }>(url(`/editor/${track.id}/analisis`))
      .then(({ analysis: found }) => {
        if (cancelled) return;
        if (found?.peaks) setAnalysis(decode(found));
        else setAnalysisError("No pudimos dibujar la onda de este audio. Igual puedes escuchar, seleccionar y cortar.");
      })
      .catch((error: unknown) => {
        if (!cancelled) setAnalysisError(error instanceof HttpError && error.status === 429 ? "Abriste muchos audios seguidos. Espera un minuto y recarga la página." : "Se cortó la conexión mientras leíamos el audio. Recarga la página.");
      });
    return () => {
      cancelled = true;
    };
  }, [url, track.id]);

  /** While the server renders, follow it; when it ends the page reloads with the edited audio. */
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(async () => {
      const response = await http.get<{ track: EditorTrack }>(url(`/editor/${track.id}/estado`)).catch(() => null);
      if (!response || response.track.edit_status === "processing") return;
      if (response.track.edit_status === "failed") {
        setStatus({ value: "failed", error: response.track.edit_error ?? "El procesamiento falló. Inténtalo de nuevo." });
        return;
      }
      allow();
      router.reload();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [processing, url, track.id, allow]);

  useEffect(
    () => () => {
      if (sample) URL.revokeObjectURL(sample.url);
    },
    [sample],
  );

  const seek = useCallback((at: number) => {
    const next = Math.max(0, Math.min(total, at));
    engine.current?.seek(next);
    setTime(next);
  }, [total]);

  const play = useCallback((from?: number) => {
    setSample(null);
    void engine.current?.play(from);
  }, []);

  const togglePlay = useCallback(() => {
    const preview = engine.current;
    if (!preview) return;
    if (preview.playing) preview.pause();
    else play(selection && loop ? selection[0] : undefined);
  }, [loop, selection, play]);

  /** Applies new cuts only when they stay within the limits, saying why otherwise. */
  const applyCuts = useCallback(
    (cuts: Cut[], after?: () => void) => {
      const next = mergeCuts(cuts, total);
      if (next.length > limits.max_cuts) {
        setNotice(`Puedes tener hasta ${limits.max_cuts} cortes en un audio.`);
        return;
      }
      if (editedLength({ ...recipeRef.current, cuts: next }, total) < limits.min_length) {
        setNotice(`Así no quedaría audio: deja al menos ${limits.min_length} s sin cortar.`);
        return;
      }
      setNotice(null);
      change((current) => ({ ...current, cuts: next }));
      after?.();
    },
    [change, limits.max_cuts, limits.min_length, total],
  );

  const cutSelection = useCallback(() => {
    if (!selection) return;
    applyCuts([...recipeRef.current.cuts, selection], () => {
      setSelection(null);
      seek(Math.min(selection[1], total));
    });
  }, [applyCuts, selection, seek, total]);

  const keepSelection = () => {
    if (!selection) return;
    applyCuts([...recipe.cuts, [0, selection[0]], [selection[1], total]], () => {
      setSelection(null);
      seek(selection[0]);
    });
  };

  const restoreSelection = () => {
    if (!selection) return;
    change((current) => ({ ...current, cuts: restoreRange(current.cuts, selection, total) }));
    setSelection(null);
  };

  const mark = useCallback(
    (edge: 0 | 1) => {
      const at = engine.current?.time ?? time;
      setSelection((range) => {
        const next: Cut = range ? [...range] : edge === 0 ? [at, total] : [0, at];
        next[edge] = at;
        return next[1] - next[0] >= 0.05 ? [Math.min(...next), Math.max(...next)] : null;
      });
    },
    [time, total],
  );

  const zoomBy = useCallback((factor: number) => setZoom((value) => Math.max(1, Math.min(Math.max(1, (total * MAX_PIXELS_PER_SECOND) / 900), value * factor))), [total]);
  const levels = useCallback(() => engine.current?.levels() ?? SILENT, []);

  useEditorKeys(
    {
      togglePlay,
      cutSelection,
      mark,
      toggleLoop: () => setLoop((value) => !value),
      toggleBypass: () => setBypass((value) => !value),
      zoomBy,
      seek,
      seekBy: (seconds) => seek((engine.current?.time ?? time) + seconds),
      clearSelection: () => setSelection(null),
      undo,
      redo,
      openGuide: () => setGuide(true),
    },
    { enabled: true, duration: total },
  );

  const listenFinal = async () => {
    engine.current?.pause();
    setSampling(true);
    setNotice(null);
    const at = Math.max(0, Math.min(toEdited(engine.current?.time ?? time, recipe, total), length - limits.preview_seconds));
    try {
      const response = await fetch(url(`/editor/${track.id}/muestra`), {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "audio/mpeg, application/json", "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrfToken() },
        body: JSON.stringify({ recipe, at }),
      });
      if (response.ok && (response.headers.get("content-type") ?? "").includes("audio")) {
        setSample({ url: URL.createObjectURL(await response.blob()), at });
      } else {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setNotice(body.message ?? (response.status === 429 ? "Pediste muchas muestras seguidas. Espera un minuto." : "No se pudo preparar la muestra."));
      }
    } catch {
      setNotice("Se cortó la conexión mientras preparábamos la muestra.");
    }
    setSampling(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const { track: updated } = await http.post<{ track: EditorTrack }>(url(`/editor/${track.id}`), { recipe });
      engine.current?.pause();
      setNotice(null);
      setStatus({ value: updated.edit_status, error: updated.edit_error });
      if (updated.edit_status !== "processing") {
        allow();
        router.reload();
      }
    } catch (error) {
      setNotice(error instanceof HttpError ? error.firstError() : "No se pudo guardar la edición.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const restore = async () => {
    setBusy(true);
    allow();
    try {
      await http.post(url(`/editor/${track.id}/restaurar`));
      router.reload();
    } catch (error) {
      allow(false);
      setNotice(error instanceof HttpError ? error.firstError() : "No se pudo restaurar el original.");
      setBusy(false);
      setConfirming(null);
    }
  };

  const playheadEdited = toEdited(time, recipe, total);
  const treatments = describeSound(recipe);
  const finalOnly = serverOnly(recipe);
  const eta = total * 0.15 < 45 ? "unos segundos" : `cerca de ${Math.max(1, Math.round((total * 0.15) / 60))} min`;

  return (
    <div className="space-y-5">
      <AudioHeader track={track} total={total} length={length} loudness={analysis?.loudness ?? null} />

      {!available && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          El procesador de audio no está disponible en este momento. Puedes preparar y escuchar la edición, pero no guardarla ni pedir la muestra final.
        </p>
      )}
      {processing && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <p>
            <b>Procesando el audio con calidad de estudio…</b> Suele tardar {eta}. Puedes quedarte aquí: la página se actualiza sola cuando termine.
          </p>
        </div>
      )}
      {status.value === "failed" && status.error && (
        <Notice text={`No se pudo guardar la edición: ${status.error}`} onClose={() => setStatus({ value: null, error: null })} />
      )}
      {notice && <Notice text={notice} onClose={() => setNotice(null)} />}

      <Panel>
        <div className="space-y-4">
          <Transport
            playing={playing}
            broken={broken}
            time={time}
            editedTime={playheadEdited}
            length={length}
            duration={total}
            loop={loop}
            bypass={bypass}
            zoom={zoom}
            levels={levels}
            onSeek={seek}
            onTogglePlay={togglePlay}
            onLoop={setLoop}
            onBypass={setBypass}
            onZoom={(factor) => (factor === null ? setZoom(1) : zoomBy(factor))}
            onGuide={() => setGuide(true)}
          />
          <div>
            <Waveform
              peaks={analysis?.peaks ?? null}
              perSecond={analysis?.perSecond ?? 100}
              duration={total}
              cuts={recipe.cuts}
              selection={selection}
              time={time}
              fades={fades}
              zoom={zoom}
              follow={playing}
              onZoom={setZoom}
              onSeek={seek}
              onSelect={setSelection}
              onCuts={(cuts) => applyCuts(cuts)}
            />
            {analysisError && <p className="mt-2 text-xs text-muted">{analysisError}</p>}
            {broken && <p className="mt-2 text-xs text-danger">El navegador no pudo reproducir este audio. Puedes cortar y ajustar igual, y escuchar el resultado con «Escuchar el resultado final».</p>}
          </div>
          <EditActions
            selection={selection}
            overlapsCut={overlapsCut}
            canCutStart={time >= 0.1 && cutAt(recipe.cuts, time) < 0}
            canCutEnd={time <= total - 0.1 && cutAt(recipe.cuts, time) < 0}
            onCut={cutSelection}
            onKeep={keepSelection}
            onRestore={restoreSelection}
            onClear={() => setSelection(null)}
            onCutStart={() => applyCuts([...recipe.cuts, [0, time]])}
            onCutEnd={() => applyCuts([...recipe.cuts, [time, total]])}
          />
        </div>
      </Panel>

      {sample && <SamplePanel url={sample.url} at={sample.at} seconds={limits.preview_seconds} serverOnly={finalOnly} onClose={() => setSample(null)} />}

      <Panel title="Cortes y transiciones" description="Así queda el audio, en orden. Puedes escuchar cada empalme o recuperar una parte cortada.">
        <PartsList
          recipe={recipe}
          duration={total}
          length={length}
          maxFade={limits.max_fade}
          maxJoin={limits.max_join}
          hasJoins={joins(recipe, total).length > 0}
          onChange={(patch, group) => change((current) => ({ ...current, ...patch }), group)}
          onListen={play}
          onSelect={setSelection}
          onRestore={(range) => change((current) => ({ ...current, cuts: restoreRange(current.cuts, range, total) }))}
          onRemove={(index) => change((current) => ({ ...current, cuts: current.cuts.filter((_, other) => other !== index) }))}
        />
      </Panel>

      <Panel
        title="Sonido"
        description="Mejora la calidad del audio. Todo se escucha al instante mientras reproduces; escribe el valor exacto en cualquier control si lo necesitas."
        actions={
          <Button
            variant="secondary"
            icon={sampling ? <Loader2 className="size-4 animate-spin" /> : <Headphones className="size-4" />}
            onClick={listenFinal}
            disabled={!available || sampling || processing || length < limits.min_length}
            title="Procesa unos segundos en el servidor con todos los filtros, incluidos los que el navegador no puede reproducir"
            className="border-info/40 text-info hover:bg-info-soft"
          >
            Escuchar el resultado final
          </Button>
        }
      >
        <SoundPanel
          recipe={recipe}
          maxGain={limits.max_gain}
          targetLufs={limits.target_lufs}
          onChange={(patch, group) => change((current) => ({ ...current, ...patch }), group)}
          onReplace={(next) => change(next)}
        />
      </Panel>

      <SaveBar
        processing={processing}
        dirty={dirty}
        edited={track.edited}
        length={length}
        treatments={treatments}
        canUndo={canUndo}
        canRedo={canRedo}
        canSave={available && dirty && !processing && !busy && !(isPlain(recipe) && !track.edited)}
        busy={busy}
        onUndo={undo}
        onRedo={redo}
        onDiscard={() => change(baseline)}
        onRestore={() => setConfirming("restore")}
        onSave={() => setConfirming("save")}
      />

      <SaveDialog open={confirming === "save"} track={track} recipe={recipe} total={total} length={length} treatments={treatments} busy={busy} onClose={() => setConfirming(null)} onConfirm={save} />
      <RestoreDialog open={confirming === "restore"} title={track.title} total={total} busy={busy} onClose={() => setConfirming(null)} onConfirm={restore} />
      <GuideDialog open={guide} onClose={() => setGuide(false)} />
      <LeaveDialog open={blocked} onStay={stay} onLeave={proceed} />
    </div>
  );
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <p className="flex-1">{text}</p>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="opacity-70 transition hover:opacity-100">
        <X className="size-4" />
      </button>
    </div>
  );
}
