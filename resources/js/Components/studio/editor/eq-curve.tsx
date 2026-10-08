import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { EQ_BANDS } from "@/lib/media/editor/recipe";

export const EQ_MAX = 12;

/** Position of a frequency on the 20 Hz – 20 kHz log axis, from 0 to 100. */
const axis = (hz: number) => (Math.log10(hz / 20) / 3) * 100;

const grid = "stroke-ink/10 [vector-effect:non-scaling-stroke]";

/** The equalizer curve, computed with the same filters the preview uses, with a dot on each band. */
export function EqCurve({ eq, lowcut }: { eq: number[]; lowcut: boolean }) {
  const curve = useMemo(() => {
    const steps = 160;
    const frequencies = new Float32Array(steps + EQ_BANDS.length);
    for (let index = 0; index < steps; index++) frequencies[index] = 20 * Math.pow(1000, index / (steps - 1));
    EQ_BANDS.forEach((band, index) => (frequencies[steps + index] = band.hz));
    const total = new Float32Array(frequencies.length).fill(0);
    try {
      const context = new OfflineAudioContext(1, 128, 44100);
      const filters = [
        ...EQ_BANDS.map((band, index) => new BiquadFilterNode(context, { type: band.type, frequency: band.hz, Q: band.type === "peaking" ? 1 : Math.SQRT1_2, gain: eq[index] ?? 0 })),
        ...(lowcut ? [new BiquadFilterNode(context, { type: "highpass", frequency: 80, Q: Math.SQRT1_2 })] : []),
      ];
      const magnitude = new Float32Array(frequencies.length);
      const phase = new Float32Array(frequencies.length);
      for (const filter of filters) {
        filter.getFrequencyResponse(frequencies, magnitude, phase);
        magnitude.forEach((value, index) => (total[index] += 20 * Math.log10(Math.max(value, 1e-4))));
      }
    } catch {
      return null;
    }
    const y = (db: number) => 50 - (Math.max(-EQ_MAX * 1.25, Math.min(EQ_MAX * 1.25, db)) / (EQ_MAX * 1.25)) * 46;
    return {
      line: Array.from(total.slice(0, steps), (db, index) => `${(index / (steps - 1)) * 100},${y(db)}`).join(" "),
      dots: EQ_BANDS.map((band, index) => ({ x: axis(band.hz), y: y(total[steps + index]) })),
      y,
    };
  }, [eq, lowcut]);

  if (!curve) return null;
  return (
    <div className="relative rounded-xl border border-line bg-canvas">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block h-36 w-full" aria-hidden>
        {[6, -6, 12, -12].map((db) => (
          <line key={db} x1={0} x2={100} y1={curve.y(db)} y2={curve.y(db)} strokeWidth={0.5} className={grid} />
        ))}
        {EQ_BANDS.map((band) => (
          <line key={band.hz} x1={axis(band.hz)} x2={axis(band.hz)} y1={0} y2={100} strokeWidth={0.5} className={grid} />
        ))}
        <line x1={0} x2={100} y1={50} y2={50} strokeWidth={0.75} strokeDasharray="3 3" className="stroke-ink/25 [vector-effect:non-scaling-stroke]" />
        <polyline points={`0,100 ${curve.line} 100,100`} className="fill-signal/10 stroke-none" />
        <polyline points={curve.line} fill="none" strokeWidth={1.75} className="stroke-signal [vector-effect:non-scaling-stroke]" />
      </svg>
      {curve.dots.map((dot, index) => (
        <span
          key={EQ_BANDS[index].hz}
          className={cn("pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas shadow", eq[index] ? "bg-signal" : "bg-faint")}
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
        />
      ))}
      <span className="pointer-events-none absolute top-1.5 left-2 text-[9.5px] font-semibold text-faint tabular">+12 dB</span>
      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-[calc(100%+2px)] text-[9.5px] font-semibold text-faint tabular">0</span>
      <span className="pointer-events-none absolute bottom-1.5 left-2 text-[9.5px] font-semibold text-faint tabular">−12 dB</span>
      <span className="pointer-events-none absolute right-2 bottom-1.5 text-[9.5px] font-semibold text-faint">20 Hz – 20 kHz</span>
    </div>
  );
}
