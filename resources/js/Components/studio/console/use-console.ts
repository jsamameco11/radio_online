import { router } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { http, HttpError } from "@/lib/http";
import { LiveCapture } from "@/lib/radio/capture";
import { ServerClock } from "@/lib/radio/clock";
import { ProgramPlayer } from "@/lib/radio/program-player";
import { Broadcaster } from "@/lib/radio/voice";
import type { BroadcastTrack, CaptureBrief, ConsoleSignal, ConsoleSnapshot, LiveMode, ProgramLayer } from "@/types/studio";

export type Notice = { tone: "error" | "info"; text: string } | null;

/** How to move a block of the main program: some minutes later, or to a time (today unless `date`). */
export type Reschedule = { minutes: number } | { time: string; date?: string };

/** Where a change of the automatic music lands. */
export type SwitchTiming = { when: "song" } | { when: "at"; at: number } | { when: "now" };

export interface PlayOptions {
  volume?: number;
  duck?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
}

/**
 * Microphone of this console: level, music bed while talking, self monitoring, input device,
 * voice processing, «Detectar voz» (the program drops while the voice is heard) and «Hablar al iniciar».
 */
export interface MicSettings {
  level: number;
  autoBed: boolean;
  selfMonitor: boolean;
  deviceId: string;
  processing: boolean;
  voiceDuck: boolean;
  talkOnStart: boolean;
}

/** Lanes that loop and fade by default: background beds. */
export const BEDS = ["F1", "F2"] as const;

export const PLAYERS = ["A", "B", "C"] as const;

const MIC_KEY = "turadio.console.mic";

const MIC_DEFAULTS: MicSettings = { level: 1, autoBed: true, selfMonitor: false, deviceId: "", processing: true, voiceDuck: true, talkOnStart: true };

const POLL_MS = 1500;

/** The choices of this computer survive a reload (the level and the device are chosen again each time). */
function savedMic(): MicSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(MIC_KEY) ?? "{}") as Partial<MicSettings>;
    const pick = (key: "autoBed" | "processing" | "voiceDuck" | "talkOnStart") => (typeof saved[key] === "boolean" ? saved[key] : MIC_DEFAULTS[key]);
    return { ...MIC_DEFAULTS, autoBed: pick("autoBed"), processing: pick("processing"), voiceDuck: pick("voiceDuck"), talkOnStart: pick("talkOnStart") };
  } catch {
    return MIC_DEFAULTS;
  }
}

/** Id of a layer fired here, in the form the server accepts (12 lowercase letters and digits). */
function layerId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => alphabet[byte % alphabet.length]).join("");
}

type Answer = { message?: string | null; snapshot?: ConsoleSnapshot; layer?: ProgramLayer; faded?: ProgramLayer[]; stopped?: string[] };

/**
 * State and engines of the live console: the server snapshot (polled every 1.5 s), the monitor
 * player, the microphone broadcaster, the live recording and the actions that change what is on air.
 */
export function useConsole(initial: ConsoleSnapshot, host: string, pending: CaptureBrief | null) {
  const url = useStudioUrl();
  const base = url("/consola");
  const clock = useMemo(() => new ServerClock(), []);
  const player = useRef<ProgramPlayer | null>(null);
  const caster = useRef<Broadcaster | null>(null);
  const captureEngine = useRef<LiveCapture | null>(null);
  caster.current ??= new Broadcaster(`${base}/senal/oferta`);

  const [snapshot, setSnapshot] = useState(initial);
  const [now, setNow] = useState(initial.radio.now);
  const [notice, setNotice] = useState<Notice>(null);
  const [monitor, setMonitor] = useState(false);
  const [monitorLevel, setMonitorLevel] = useState(0.8);
  const [micOpen, setMicOpen] = useState(false);
  const [mic, setMic] = useState<MicSettings>(savedMic);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [talking, setTalking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [title, setTitle] = useState(initial.live.title);
  const [hostName, setHostName] = useState(initial.live.host || host);
  const [busy, setBusy] = useState(false);
  const [blend, setBlend] = useState(3);
  const [capturing, setCapturing] = useState(false);
  const [capture, setCapture] = useState<CaptureBrief | null>(pending?.status === "ready" ? pending : null);
  const [connected, setConnected] = useState(0);
  /** Pads fired here that the server has not confirmed yet: they keep sounding meanwhile. */
  const firing = useRef<ProgramLayer[]>([]);
  const padSounds = useRef<BroadcastTrack[]>([]);
  const heldRef = useRef(false);

  const apply = useCallback((data: ConsoleSnapshot, broadcast = false) => {
    const waiting = firing.current.filter((layer) => !data.radio.layers.some((item) => item.id === layer.id));
    const radio = waiting.length ? { ...data.radio, layers: [...data.radio.layers, ...waiting] } : data.radio;
    setSnapshot({ ...data, radio });
    const holding = data.upcoming.some((block) => block.held);
    if (heldRef.current && !holding) router.reload({ only: ["day"] });
    heldRef.current = holding;
    const engine = player.current;
    engine?.setReserve(data.radio.fallback);
    engine?.setQueue(data.radio.queue);
    engine?.setMix(data.radio.mix);
    engine?.setLayers(radio.layers);
    if (broadcast) caster.current?.broadcast({ t: "mix", mix: data.radio.mix, rev: data.live.rev });
  }, []);

  /** Sends an action; on success applies the snapshot and shows the message, on failure shows why. */
  const run = useCallback(
    async <T extends Answer>(method: "post" | "put" | "patch" | "delete", path: string, body?: unknown, broadcast = false): Promise<T | null> => {
      try {
        const data = await http[method]<T>(`${base}${path}`, body);
        if (data.snapshot) apply(data.snapshot, broadcast);
        if (data.message) setNotice({ tone: "info", text: data.message });
        return data;
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof HttpError ? error.firstError() : "No hubo conexión con el servidor. Inténtalo de nuevo." });
        return null;
      }
    },
    [apply, base],
  );

  useEffect(() => {
    clock.seed(initial.radio.now);
    const timer = window.setInterval(() => setNow(clock.now()), 250);
    return () => window.clearInterval(timer);
  }, [clock, initial.radio.now]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const loop = async () => {
      const sent = Date.now();
      try {
        const data = await http.get<{ snapshot: ConsoleSnapshot; signal: ConsoleSignal | null }>(`${base}/senal`, { cache: "no-store" });
        clock.sample(data.snapshot.radio.now, sent, Date.now());
        if (!stop) apply(data.snapshot);
        const engine = caster.current;
        if (data.signal && engine?.open) {
          await engine.accept(data.signal.answers);
          if (data.signal.pending.length) void engine.serve(data.signal.pending, data.snapshot.radio.ice);
          engine.prune(data.signal.alive);
        }
        if (!data.snapshot.live.session && engine?.peers.size) engine.dropAll();
        setConnected(engine?.connected ?? 0);
      } catch {
        // A network hiccup: the next poll tries again.
      }
      if (!stop) timer = window.setTimeout(loop, POLL_MS);
    };
    void loop();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [apply, base, clock]);

  useEffect(() => {
    const engine = caster.current;
    if (!engine) return;
    engine.setDetect(mic.voiceDuck);
    engine.onVoice = (on) => {
      setSpeaking(on);
      player.current?.setVoice(on);
    };
    return () => {
      engine.onVoice = undefined;
    };
  }, [mic.voiceDuck]);

  useEffect(() => {
    const { autoBed, processing, voiceDuck, talkOnStart } = mic;
    window.localStorage.setItem(MIC_KEY, JSON.stringify({ autoBed, processing, voiceDuck, talkOnStart }));
  }, [mic]);

  useEffect(
    () => () => {
      player.current?.close();
      caster.current?.shutdown();
    },
    [],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (caster.current?.open || capturing) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [capturing]);

  useEffect(() => {
    if (pending?.status !== "recording") return;
    if (!pending.stale) {
      setNotice({ tone: "info", text: "Hay una grabación en curso en otra pestaña. Déjala terminar allí." });
      return;
    }
    void http
      .post<{ recording: CaptureBrief }>(`${base}/grabacion/${pending.id}/fin`, { duration: pending.duration ?? 0 })
      .then(({ recording }) => recording.status === "ready" && setCapture(recording))
      .catch(() => undefined);
  }, [base, pending]);

  /** Plays, stops or adjusts a sound on top of the program and tells connected listeners right away. */
  const layerAnswer = useCallback((data: Answer | null) => {
    if (!data) return;
    [...(data.faded ?? []), ...(data.layer ? [data.layer] : [])].forEach((item) => {
      const layer = { ...item, source: "live" as const };
      player.current?.pushLayer(layer);
      caster.current?.broadcast({ t: "layer", layer });
    });
    if (data.stopped?.length) {
      player.current?.dropLayers(data.stopped);
      caster.current?.broadcast({ t: "stop", ids: data.stopped });
    }
  }, []);

  /** Plays a library audio on a lane; on a lane that already sounds, a fade in crossfades with it. */
  const play = useCallback(
    async (track: BroadcastTrack, lane: string, options: PlayOptions = {}) => {
      const data = await run<Answer>("post", "/capas", {
        track: track.id,
        lane,
        volume: options.volume ?? 100,
        duck: options.duck ?? null,
        fade_in: options.fadeIn ?? 0,
        fade_out: options.fadeOut ?? 0,
        loop: options.loop ?? false,
      });
      layerAnswer(data);
      return data;
    },
    [layerAnswer, run],
  );

  /** Stops a layer, a lane or every console sound: cut at once, or faded out over some seconds. */
  const stop = useCallback(
    async (target: { lane?: string; layer?: string }, seconds = 0) => {
      layerAnswer(await run<Answer>("delete", "/capas", { lane: target.lane ?? null, layer: target.layer ?? null, fade: seconds }));
    },
    [layerAnswer, run],
  );

  const adjustLayer = useCallback(
    async (layer: string, volume: number, duck: boolean) => {
      layerAnswer(await run<Answer>("patch", `/capas/${layer}`, { volume, duck }));
    },
    [layerAnswer, run],
  );

  /**
   * A pad sounds in the monitor the instant it is pressed (its audio is already decoded); the
   * server then confirms it with the same id and start for every listener.
   */
  const firePad = useCallback(
    async (track: BroadcastTrack) => {
      if (!track.src) return;
      const at = Math.round(clock.now());
      const length = Math.round(track.duration * 1000);
      const layer: ProgramLayer = { id: layerId(), lane: "pad", track_id: track.id, title: track.title, kind: track.kind, src: track.src, start: at, end: at + length, volume: 100, duck: track.duck, source: "live", fade_in: 0, fade_out: 0, loop: false, length };
      firing.current = [...firing.current, layer];
      player.current?.pushLayer(layer);
      caster.current?.broadcast({ t: "layer", layer });
      const data = await run<Answer>("post", "/capas", { track: track.id, lane: "pad", layer: layer.id, at });
      firing.current = firing.current.filter((item) => item.id !== layer.id);
      if (data?.layer) return;
      player.current?.dropLayers([layer.id]);
      caster.current?.broadcast({ t: "stop", ids: [layer.id] });
    },
    [clock, run],
  );

  /** The pad bank keeps its sounds decoded in the monitor, ready to fire without loading. */
  const warmPads = useCallback((tracks: BroadcastTrack[]) => {
    padSounds.current = tracks;
    player.current?.warm(tracks);
  }, []);

  async function toggleMonitor() {
    if (monitor) {
      player.current?.stop();
      setMonitor(false);
      return;
    }
    const engine = player.current ?? new ProgramPlayer(clock, "interactive");
    player.current = engine;
    engine.warm(padSounds.current);
    await engine.start();
    engine.setVolume(monitorLevel);
    engine.setReserve(snapshot.radio.fallback);
    engine.setQueue(snapshot.radio.queue);
    engine.setMix(snapshot.radio.mix);
    engine.setLayers(snapshot.radio.layers);
    engine.setVoice(caster.current?.speaking ?? false);
    setMonitor(true);
  }

  function changeMonitorLevel(value: number) {
    setMonitorLevel(value);
    player.current?.setVolume(value);
  }

  async function openMic(settings: MicSettings = mic): Promise<boolean> {
    const engine = caster.current;
    if (!engine) return false;
    try {
      await engine.openMic(settings.deviceId || null, settings.processing);
      engine.setLevel(settings.level);
      engine.setTalking(talking);
      engine.setReturn(settings.selfMonitor);
      setMicOpen(true);
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((device) => device.kind === "audioinput"));
      return true;
    } catch {
      setNotice({ tone: "error", text: "No pudimos usar el micrófono. Permite el acceso al micrófono en el navegador (ícono del candado junto a la dirección) e inténtalo otra vez." });
      return false;
    }
  }

  function changeMic(next: Partial<MicSettings>) {
    const merged = { ...mic, ...next };
    setMic(merged);
    if (next.level !== undefined) caster.current?.setLevel(next.level);
    if (next.selfMonitor !== undefined) caster.current?.setReturn(next.selfMonitor);
    if ((next.deviceId !== undefined || next.processing !== undefined) && micOpen) void openMic(merged);
  }

  async function beginCapture(session: string) {
    const engine = caster.current;
    if (!engine || captureEngine.current) return;
    const recorder = new LiveCapture(engine, `${base}/grabacion`);
    captureEngine.current = recorder;
    try {
      await recorder.start(session);
      setCapturing(true);
    } catch (error) {
      captureEngine.current = null;
      setNotice({ tone: "error", text: error instanceof HttpError ? error.firstError() : error instanceof Error ? error.message : "No pudimos empezar a grabar." });
    }
  }

  async function endCapture() {
    const recorder = captureEngine.current;
    if (!recorder || recorder.done) return;
    setCapturing(false);
    try {
      const recording = await recorder.finish();
      if (recording?.status === "ready") setCapture(recording);
      else if (recording?.status === "discarded") setNotice({ tone: "info", text: "La transmisión fue muy corta y no se guardó el audio." });
      if (recorder.problem) setNotice({ tone: "error", text: recorder.problem });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof HttpError ? error.firstError() : "No pudimos cerrar la grabación." });
    }
    captureEngine.current = null;
  }

  const endCaptureRef = useRef(endCapture);
  endCaptureRef.current = endCapture;
  const sessionSeen = useRef(snapshot.live.session);
  useEffect(() => {
    const previous = sessionSeen.current;
    sessionSeen.current = snapshot.live.session;
    if (previous && !snapshot.live.session) void endCaptureRef.current();
  }, [snapshot.live.session]);

  /**
   * Opens or closes the microphone on air. With «Detectar voz» the program drops only while the
   * voice is heard; without it, «Fondo automático» keeps the music at bed level the whole time.
   */
  async function talk(next: boolean) {
    caster.current?.setTalking(next);
    setTalking(next);
    const bed = next ? mic.autoBed && !mic.voiceDuck : mic.autoBed;
    await run("put", "/mezcla", bed ? { mic: next, bed: next } : { mic: next }, true);
  }

  async function startLive(record: boolean) {
    setBusy(true);
    setNotice(null);
    if (await openMic()) {
      const data = await run<Answer>("post", "/vivo", { host: hostName, title }, true);
      const session = data?.snapshot?.live.session;
      if (session && mic.talkOnStart) {
        await talk(true);
        setNotice({ tone: "info", text: mic.voiceDuck ? "¡Estás al aire! Habla cuando quieras: la música baja sola mientras se oye tu voz." : "¡Estás al aire con tu voz! Usa «Hablar» para cerrar o abrir el micrófono." });
      }
      if (session && record) await beginCapture(session);
      if (!session) {
        caster.current?.closeMic();
        setMicOpen(false);
      }
    }
    setBusy(false);
  }

  async function stopLive() {
    if (!window.confirm("¿Terminar la transmisión en vivo? La grabación se detiene y podrás guardarla.")) return;
    setBusy(true);
    caster.current?.setTalking(false);
    setTalking(false);
    await endCapture();
    await run("delete", "/vivo");
    caster.current?.dropAll();
    caster.current?.closeMic();
    setMicOpen(false);
    setBusy(false);
  }

  async function toggleAir() {
    const on = !snapshot.config.on_air;
    if (!on && !window.confirm("¿Sacar la radio del aire? Los oyentes dejarán de escuchar la programación.")) return;
    await run("put", "/aire", { on });
  }

  /** Console faders and switches; every listener applies the new mix at once. */
  const mix = useCallback((changes: Partial<Record<"music" | "overlay" | "pads", number> & Record<"muted" | "bed", boolean>>) => run("put", "/mezcla", changes, true), [run]);

  async function saveTitles() {
    await run("put", "/mezcla", { host: hostName, title });
  }

  async function toggleAutofill() {
    const on = !snapshot.config.autofill;
    if (!on && !window.confirm("¿Detener la música automática? Lo que no esté programado quedará en silencio hasta que la inicies de nuevo.")) return;
    await run("put", "/musica/continua", { on });
  }

  return {
    url,
    base,
    clock,
    snapshot,
    now,
    notice,
    setNotice,
    run,
    monitor,
    monitorLevel,
    toggleMonitor,
    changeMonitorLevel,
    micOpen,
    mic,
    devices,
    changeMic,
    openMic,
    talking,
    speaking,
    connected,
    title,
    setTitle,
    hostName,
    setHostName,
    saveTitles,
    busy,
    blend,
    setBlend,
    caster,
    player,
    play,
    stop,
    adjustLayer,
    firePad,
    warmPads,
    mix,
    talk,
    startLive,
    stopLive,
    toggleAir,
    toggleAutofill,
    setRepeat: (on: boolean) => run("put", "/musica/repetir", { on }),
    setLiveMode: (mode: LiveMode) => run("put", "/modo-vivo", { mode }),
    cutMusic: () => run("post", "/corte"),
    resumeMusic: (source?: { playlist: string | null; shuffle: boolean }) => run("delete", "/corte", source ? { change: true, ...source } : {}),
    switchSource: (playlist: string | null, shuffle: boolean, timing: SwitchTiming) => run("put", "/musica/fuente", { playlist, shuffle, when: timing.when, at: timing.when === "at" ? timing.at : null }),
    startAutopilot: (playlist: string | null, shuffle: boolean, first: string | null, repeat: boolean) => run("post", "/musica", { playlist, shuffle, first, repeat }),
    cancelSwitch: () => run("delete", "/musica/cambio"),
    reschedule: async (slot: string, change: Reschedule) => {
      const data = await run("patch", `/bloques/${slot}`, change);
      if (data) router.reload({ only: ["day"] });
      return data !== null;
    },
    capturing,
    capture,
    clearCapture: () => setCapture(null),
  };
}

export type ConsoleApi = ReturnType<typeof useConsole>;
