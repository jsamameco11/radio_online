import { Switch } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { EQ_BANDS, PRESETS, applyPreset, type Recipe } from "@/lib/media/editor/recipe";

interface Props {
  recipe: Recipe;
  maxGain: number;
  onChange: (recipe: Recipe) => void;
}

function Slider({ label, hint, value, min, max, step = 1, unit = "", onChange }: { label: string; hint?: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted tabular">
          {value > 0 && min < 0 ? "+" : ""}
          {Number.isInteger(step) ? value : value.toFixed(1)}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[var(--signal)]" />
      {hint && <span className="block text-xs text-faint">{hint}</span>}
    </label>
  );
}

/** Presets and the sound treatment: the same chain the server renders. */
export function SoundPanel({ recipe, maxGain, onChange }: Props) {
  const set = <K extends keyof Recipe>(key: K, value: Recipe[K]) => onChange({ ...recipe, [key]: value, preset: null });

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((preset) => {
          const active = (recipe.preset ?? "natural") === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => onChange(applyPreset(recipe, preset))}
              className={cn("rounded-xl border p-3 text-left transition", active ? "border-signal bg-signal-soft" : "border-line hover:bg-raised")}
            >
              <span className="block text-sm font-medium">{preset.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{preset.text}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Volumen</h4>
          <Slider label="Nivel" value={recipe.gain} min={-maxGain} max={maxGain} step={0.5} unit=" dB" onChange={(gain) => set("gain", gain)} />
          <Switch checked={recipe.normalize} onChange={(normalize) => set("normalize", normalize)} label="Volumen estándar de radio" description="Lleva el audio al mismo volumen que el resto de la programación." />
          <Slider label="Compresión" hint="Empareja las partes suaves y fuertes." value={recipe.compress} min={0} max={100} unit="%" onChange={(compress) => set("compress", compress)} />
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Ecualizador</h4>
          {EQ_BANDS.map((band, index) => (
            <Slider
              key={band.hz}
              label={band.label}
              hint={band.hint}
              value={recipe.eq[index] ?? 0}
              min={-12}
              max={12}
              step={0.5}
              unit=" dB"
              onChange={(gain) => set("eq", recipe.eq.map((current, other) => (other === index ? gain : current)))}
            />
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Voz y limpieza</h4>
          <Slider label="Resaltar voz" value={recipe.voice} min={0} max={100} unit="%" onChange={(voice) => set("voice", voice)} />
          <Slider label="Amplitud estéreo" value={recipe.width} min={-100} max={100} unit="%" onChange={(width) => set("width", width)} />
          <Switch checked={recipe.lowcut} onChange={(lowcut) => set("lowcut", lowcut)} label="Quitar zumbidos graves" description="Filtra golpes de micrófono y ruido eléctrico." />
          <Slider label="Reducción de ruido" hint="Se escucha en la muestra final y en el archivo guardado." value={recipe.denoise} min={0} max={100} unit="%" onChange={(denoise) => set("denoise", denoise)} />
          <Slider label="Suavizar «eses»" hint="Se escucha en la muestra final y en el archivo guardado." value={recipe.deess} min={0} max={100} unit="%" onChange={(deess) => set("deess", deess)} />
        </div>
      </div>
    </div>
  );
}
