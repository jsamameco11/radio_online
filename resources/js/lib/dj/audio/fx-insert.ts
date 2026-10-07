import type { EffectKind, FxState } from "../types";
import { createEffect } from "./effects/create-effect";
import type { Effect } from "./effects/effect";
import type { InsertPoint } from "./insert-point";

/** The beat FX unit: one effect at a time, inserted on a channel or on the master. */
export class FxInsert {
  private effect: Effect | null = null;
  private kind: EffectKind | null = null;
  private point: InsertPoint | null = null;

  constructor(private readonly ctx: AudioContext) {}

  /** Puts the chosen effect at `point` (rebuilding it when the kind changes) with its level and switch. */
  apply(fx: FxState, point: InsertPoint): void {
    if (this.effect && this.kind !== fx.kind) {
      this.unplug();
      this.effect.dispose();
      this.effect = null;
    }
    const effect = this.effect ?? createEffect(this.ctx, fx.kind);
    this.effect = effect;
    this.kind = fx.kind;
    if (this.point !== point) {
      this.unplug();
      point.from.disconnect();
      point.from.connect(effect.input);
      effect.output.connect(point.to);
      this.point = point;
    }
    effect.setDepth(fx.depth);
    effect.setOn(fx.on);
  }

  /** Length of the effect's cycle, in seconds (beat length × division). */
  setCycle(seconds: number): void {
    this.effect?.setCycle(seconds);
  }

  dispose(): void {
    this.unplug();
    this.effect?.dispose();
    this.effect = null;
  }

  private unplug(): void {
    if (!this.effect || !this.point) return;
    this.effect.output.disconnect();
    this.point.from.disconnect();
    this.point.from.connect(this.point.to);
    this.point = null;
  }
}
