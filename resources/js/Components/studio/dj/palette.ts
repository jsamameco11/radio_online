/** Hot cue colours, in pad order, as theme tokens (for canvases) and as classes (for pads). */
const HOT_TOKENS = ["signal", "gold", "onair", "info", "warning", "danger", "ink", "muted"] as const;

export const HOT_CLASSES = ["bg-signal", "bg-gold", "bg-onair", "bg-info", "bg-warning", "bg-danger", "bg-ink", "bg-muted"] as const;

export interface WavePalette {
  low: string;
  mid: string;
  high: string;
  grid: string;
  downbeat: string;
  head: string;
  cue: string;
  loop: string;
  shade: string;
  hot: string[];
}

/** The design tokens of the theme the canvas sits in, so the waveforms follow the dark studio theme. */
export function wavePalette(element: Element): WavePalette {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(`--${name}`).trim();
  return {
    low: token("info"),
    mid: token("gold"),
    high: token("ink"),
    grid: token("line-strong"),
    downbeat: token("muted"),
    head: token("signal"),
    cue: token("gold"),
    loop: token("onair"),
    shade: token("canvas"),
    hot: HOT_TOKENS.map(token),
  };
}
