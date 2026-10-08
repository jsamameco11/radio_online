/** Lowest and highest sample between two moments (each slice of the peaks holds a min and a max). */
function range(peaks: Int8Array, perSecond: number, from: number, to: number): [number, number] {
  const slices = peaks.length / 2;
  const first = Math.max(0, Math.floor(from * perSecond));
  const last = Math.min(slices, Math.max(first + 1, Math.ceil(to * perSecond)));
  if (first >= slices) return [0, 0];
  let low = 0;
  let high = 0;
  for (let index = first; index < last; index++) {
    low = Math.min(low, peaks[index * 2]);
    high = Math.max(high, peaks[index * 2 + 1]);
  }
  return [low / 128, high / 128];
}

/** Draws the peaks one pixel column at a time; `paint` picks the colour of the moment each column starts at. */
export function drawWave(
  context: CanvasRenderingContext2D,
  peaks: Int8Array,
  perSecond: number,
  width: number,
  top: number,
  height: number,
  start: number,
  pixelsPerSecond: number,
  paint: (time: number) => string,
) {
  const middle = top + height / 2;
  const scale = (height / 2) * 0.94;
  let current = "";
  for (let x = 0; x < width; x++) {
    const from = start + x / pixelsPerSecond;
    const [low, high] = range(peaks, perSecond, from, from + 1 / pixelsPerSecond);
    const fill = paint(from);
    if (fill !== current) {
      context.fillStyle = fill;
      current = fill;
    }
    const y1 = middle - Math.max(high * scale, 0.5);
    const y2 = middle - Math.min(low * scale, -0.5);
    context.fillRect(x, y1, 1, y2 - y1);
  }
}

/** Sizes the backing store of a canvas to its CSS size on high-density screens and returns its context. */
export function prepare(element: HTMLCanvasElement, width: number, height: number) {
  const ratio = window.devicePixelRatio || 1;
  if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio);
  if (element.height !== Math.round(height * ratio)) element.height = Math.round(height * ratio);
  const context = element.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}
