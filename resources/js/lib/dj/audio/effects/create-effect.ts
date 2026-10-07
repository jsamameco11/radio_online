import type { EffectKind } from "../../types";
import { createBitcrush } from "./bitcrush";
import { createEcho } from "./echo";
import type { Effect } from "./effect";
import { createFilterSweep } from "./filter-sweep";
import { createFlanger } from "./flanger";
import { createReverb } from "./reverb";
import { createTrans } from "./trans";

const FACTORIES: Record<EffectKind, (ctx: AudioContext) => Effect> = {
  echo: createEcho,
  reverb: createReverb,
  flanger: createFlanger,
  filter: createFilterSweep,
  trans: createTrans,
  crush: createBitcrush,
};

/**
 * Trail effects (echo, reverb, flanger) keep the dry signal and close only their send when they
 * turn off, so what they hold fades out naturally; the others replace the signal while on.
 */
export function createEffect(ctx: AudioContext, kind: EffectKind): Effect {
  return FACTORIES[kind](ctx);
}
