import { EFFECTS, EQ_RANGE, FX_BEATS, MASTER_MAX, SECONDS_PER_TURN, TRIM_DB } from "../constants";
import type { DjEngine } from "../engine";
import type { DeckId, PadMode } from "../types";
import type { MidiEvent } from "./controls";

/** Steps of a DJ controller's platter in one turn. */
const JOG_TICKS = 720;

const PAD_MODES: Record<string, PadMode> = { hotcue: "hotcue", hotcueDelete: "hotcue", loop: "loop", jump: "jump", sample: "sampler" };

/** What a controller needs from the console beyond the engine. */
export interface MidiContext {
  /** Shift held on each deck. */
  shift: [boolean, boolean];
  invertTempo: boolean;
  browse(steps: number): void;
  load(id: DeckId): void;
  notice(text: string): void;
}

/** A knob centred at 12 o'clock, from -1 to 1, with a small dead zone in the middle. */
const centred = (value: number): number => (Math.abs(value - 0.5) < 0.01 ? 0 : value * 2 - 1);

const eqFrom = (value: number): number => {
  const position = centred(value);
  return position < 0 ? -EQ_RANGE.min * position : EQ_RANGE.max * position;
};

/** Runs what a hardware control does on the console. */
export function dispatchMidi(engine: DjEngine, event: MidiEvent, context: MidiContext): void {
  const deck = /^d([12])\.(.+)$/.exec(event.control.id);
  if (deck) deckAction(engine, deck[1] === "1" ? 0 : 1, deck[2], event, context);
  else mixerAction(engine, event.control.id, event, context);
}

function deckAction(engine: DjEngine, id: DeckId, action: string, event: MidiEvent, context: MidiContext): void {
  const { pressed, value, steps } = event;
  const state = engine.getState();
  const deck = state.decks[id];
  const pad = /^(hotcueDelete|hotcue|loop|jump|sample)(\d)$/.exec(action);
  if (pad) {
    if (pressed) engine.triggerPad(id, PAD_MODES[pad[1]], Number(pad[2]) - 1, pad[1] === "hotcueDelete" || context.shift[id]);
    return;
  }
  switch (action) {
    case "play":
      if (pressed) engine.togglePlay(id);
      break;
    case "cue":
      if (pressed) engine.cueDown(id);
      else engine.cueUp(id);
      break;
    case "sync":
      if (pressed) {
        const problem = engine.toggleSync(id);
        if (problem) context.notice(problem);
      }
      break;
    case "keylock":
      if (pressed) engine.setKeylock(id, !deck.keylock);
      break;
    case "shift":
      context.shift[id] = pressed;
      break;
    case "load":
      if (pressed) context.load(id);
      break;
    case "tempo":
      engine.setTempo(id, context.invertTempo ? 1 - value * 2 : value * 2 - 1);
      break;
    case "jogTouch":
      if (!deck.vinyl) break;
      if (pressed) engine.scratchStart(id);
      else engine.scratchEnd(id);
      break;
    case "scratch":
      if (engine.isScratching(id)) engine.scratchMove(id, (steps / JOG_TICKS) * SECONDS_PER_TURN);
      else engine.jog(id, steps / JOG_TICKS);
      break;
    case "jog":
      engine.jog(id, steps / JOG_TICKS);
      break;
    case "loopIn":
      if (pressed) engine.loopIn(id);
      break;
    case "loopOut":
      if (pressed) engine.loopOut(id);
      break;
    case "reloop":
      if (pressed) engine.reloop(id);
      break;
    case "loopHalve":
      if (pressed) engine.resizeLoop(id, 0.5);
      break;
    case "loopDouble":
      if (pressed) engine.resizeLoop(id, 2);
      break;
    case "pfl":
      if (pressed) engine.setChannel(id, { cue: !state.channels[id].cue });
      break;
    case "fader":
      engine.setChannel(id, { fader: value });
      break;
    case "trim":
      engine.setChannel(id, { trim: (value * 2 - 1) * TRIM_DB });
      break;
    case "high":
      engine.setChannel(id, { high: eqFrom(value) });
      break;
    case "mid":
      engine.setChannel(id, { mid: eqFrom(value) });
      break;
    case "low":
      engine.setChannel(id, { low: eqFrom(value) });
      break;
    case "filter":
      engine.setChannel(id, { filter: centred(value) });
      break;
  }
}

function mixerAction(engine: DjEngine, action: string, event: MidiEvent, context: MidiContext): void {
  const { pressed, value, steps } = event;
  const { fx } = engine.getState();
  switch (action) {
    case "crossfader":
      engine.setMixer({ crossfader: value * 2 - 1 });
      break;
    case "master":
      engine.setMixer({ master: value * MASTER_MAX });
      break;
    case "cueMix":
      engine.setMixer({ cueMix: value });
      break;
    case "phones":
      engine.setMixer({ phones: value });
      break;
    case "browse":
      context.browse(steps);
      break;
    case "fxOn":
      if (pressed) engine.setFx({ on: !fx.on });
      break;
    case "fxDepth":
      engine.setFx({ depth: value });
      break;
    case "fxNext":
      if (pressed) engine.setFx({ kind: EFFECTS[(EFFECTS.findIndex((effect) => effect.kind === fx.kind) + 1) % EFFECTS.length].kind });
      break;
    case "fxBeatDown":
    case "fxBeatUp": {
      if (!pressed) break;
      const index = FX_BEATS.indexOf(fx.beats) + (action === "fxBeatUp" ? 1 : -1);
      engine.setFx({ beats: FX_BEATS[Math.min(FX_BEATS.length - 1, Math.max(0, index))] });
      break;
    }
  }
}
