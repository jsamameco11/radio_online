import { HOT_CUES } from "../constants";
import type { MidiMapping } from "./controls";

const MIXER_CHANNEL = 6;
const FX_CHANNEL = 4;
/** Pad notes of each pad mode, from the first pad. */
const PAD_NOTES = { hotcue: 0x00, loop: 0x60, jump: 0x20, sample: 0x30 };

/**
 * Base map of the Pioneer DJ DDJ-400 (from its public MIDI layout): deck 1 on channel 1, deck 2 on
 * channel 2, the mixer on channel 7 and the pads by pad mode (shifted hot cues erase). Master level
 * and headphones are analogue on that unit. Anything that does not answer can be reassigned with «Aprender».
 */
export function ddj400Mapping(): MidiMapping {
  const map: MidiMapping = {};
  ([0, 1] as const).forEach((deck) => {
    const p = `d${deck + 1}`;
    const ch = deck;
    map[`n:${ch}:${0x0b}`] = `${p}.play`;
    map[`n:${ch}:${0x0c}`] = `${p}.cue`;
    map[`n:${ch}:${0x58}`] = `${p}.sync`;
    map[`n:${ch}:${0x3f}`] = `${p}.shift`;
    map[`n:${ch}:${0x54}`] = `${p}.pfl`;
    map[`n:${ch}:${0x10}`] = `${p}.loopIn`;
    map[`n:${ch}:${0x11}`] = `${p}.loopOut`;
    map[`n:${ch}:${0x4d}`] = `${p}.reloop`;
    map[`n:${ch}:${0x36}`] = `${p}.jogTouch`;
    map[`c:${ch}:${0x21}`] = `${p}.jog`;
    map[`c:${ch}:${0x22}`] = `${p}.scratch`;
    map[`c:${ch}:${0x00}`] = `${p}.tempo`;
    map[`c:${ch}:${0x13}`] = `${p}.fader`;
    map[`c:${ch}:${0x04}`] = `${p}.trim`;
    map[`c:${ch}:${0x07}`] = `${p}.high`;
    map[`c:${ch}:${0x0b}`] = `${p}.mid`;
    map[`c:${ch}:${0x0f}`] = `${p}.low`;
    map[`c:${MIXER_CHANNEL}:${0x17 + deck}`] = `${p}.filter`;
    map[`n:${MIXER_CHANNEL}:${0x46 + deck}`] = `${p}.load`;
    const pads = 7 + deck * 2;
    for (let i = 0; i < HOT_CUES; i++) {
      map[`n:${pads}:${PAD_NOTES.hotcue + i}`] = `${p}.hotcue${i + 1}`;
      map[`n:${pads + 1}:${PAD_NOTES.hotcue + i}`] = `${p}.hotcueDelete${i + 1}`;
      map[`n:${pads}:${PAD_NOTES.loop + i}`] = `${p}.loop${i + 1}`;
      map[`n:${pads}:${PAD_NOTES.jump + i}`] = `${p}.jump${i + 1}`;
      map[`n:${pads}:${PAD_NOTES.sample + i}`] = `${p}.sample${i + 1}`;
    }
  });
  map[`c:${MIXER_CHANNEL}:${0x1f}`] = "crossfader";
  map[`c:${MIXER_CHANNEL}:${0x40}`] = "browse";
  map[`n:${FX_CHANNEL}:${0x47}`] = "fxOn";
  map[`c:${FX_CHANNEL}:${0x02}`] = "fxDepth";
  map[`n:${FX_CHANNEL}:${0x63}`] = "fxNext";
  map[`n:${FX_CHANNEL}:${0x4a}`] = "fxBeatDown";
  map[`n:${FX_CHANNEL}:${0x4b}`] = "fxBeatUp";
  return map;
}
