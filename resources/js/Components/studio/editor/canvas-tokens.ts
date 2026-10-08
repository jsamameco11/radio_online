/** Design tokens read from CSS variables, so the canvases follow the (dark) studio theme. */
export type CanvasTokens = {
  canvas: string;
  surface: string;
  raised: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  lineStrong: string;
  signal: string;
  danger: string;
  info: string;
  gold: string;
  font: string;
};

export function readTokens(element: Element): CanvasTokens {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    canvas: read("--canvas"),
    surface: read("--surface"),
    raised: read("--raised"),
    ink: read("--ink"),
    muted: read("--muted"),
    faint: read("--faint"),
    line: read("--line"),
    lineStrong: read("--line-strong"),
    signal: read("--signal"),
    danger: read("--danger"),
    info: read("--info"),
    gold: read("--gold"),
    font: read("--font-sans") || "ui-sans-serif, system-ui, sans-serif",
  };
}

/** A token with transparency: canvases cannot apply opacity to a CSS variable. */
export function alpha(color: string, amount: number): string {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
    const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
    return `rgba(${red}, ${green}, ${blue}, ${amount})`;
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/i)?.[1];
  if (rgb) {
    const [red, green, blue] = rgb.split(/[\s,/]+/);
    return `rgba(${red}, ${green}, ${blue}, ${amount})`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, transparent)`;
}
