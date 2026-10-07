/** Where an effect can be inserted: `from` normally feeds `to`, and an insert sits between them. */
export interface InsertPoint {
  readonly from: GainNode;
  readonly to: GainNode;
}

export function createInsertPoint(ctx: AudioContext): InsertPoint {
  const from = ctx.createGain();
  const to = ctx.createGain();
  from.connect(to);
  return { from, to };
}
