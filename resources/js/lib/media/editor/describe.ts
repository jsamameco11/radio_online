import { EQ_BANDS, PRESETS, type Cut, type Recipe } from "./recipe";

export type Piece = { range: Cut; cut: boolean; number: number };

/** The parts that stay and the parts cut, in order; the parts that stay are numbered. */
export function timeline(parts: Cut[], cuts: Cut[]): Piece[] {
  const pieces = [...parts.map((range) => ({ range, cut: false })), ...cuts.map((range) => ({ range, cut: true }))].sort((a, b) => a.range[0] - b.range[0]);
  let number = 0;
  return pieces.map((piece) => ({ ...piece, number: piece.cut ? 0 : ++number }));
}

/** «Resaltar voz 60 %», «Ecualizador (…)»: what the sound settings do, in words. */
export function describeSound(recipe: Recipe): string[] {
  const preset = PRESETS.find((item) => item.key === recipe.preset);
  const eq = recipe.eq.map((gain, index) => (gain ? `${EQ_BANDS[index].label} ${gain > 0 ? "+" : ""}${gain} dB` : null)).filter(Boolean);
  return [
    preset && `Estilo «${preset.name}»`,
    recipe.voice > 0 && `Resaltar voz ${recipe.voice} %`,
    recipe.width !== 0 && `Estéreo ${recipe.width > 0 ? "+" : ""}${recipe.width} %`,
    eq.length > 0 && `Ecualizador (${eq.join(", ")})`,
    recipe.compress > 0 && `Compresión ${recipe.compress} %`,
    recipe.gain !== 0 && `Volumen ${recipe.gain > 0 ? "+" : ""}${recipe.gain} dB`,
    recipe.normalize && "Volumen normalizado",
    recipe.lowcut && "Sin retumbe",
    recipe.denoise > 0 && `Menos ruido ${recipe.denoise} %`,
    recipe.deess > 0 && `«Eses» suavizadas ${recipe.deess} %`,
  ].filter(Boolean) as string[];
}

/** «1 episodio», «3 bloques»: a count with its noun. */
export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
