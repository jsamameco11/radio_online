import type { ReactNode } from "react";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { EQ_BANDS, PRESETS, applyPreset, type Recipe } from "@/lib/media/editor/recipe";
import { FinalOnly, Slider, Toggle, rangeClass, rangeFill, type Update } from "./controls";
import { EQ_MAX, EqCurve } from "./eq-curve";
import { NumberField } from "./number-field";

const frequency = (hz: number) => (hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`);

function Section({ title, text, actions, className, children }: { title: string; text: string; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-line bg-raised p-4 md:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted">{text}</p>
        </div>
        {actions}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

function Equalizer({ recipe, onChange }: { recipe: Recipe; onChange: Update }) {
  const flat = recipe.eq.every((gain) => gain === 0);
  const setBand = (index: number, gain: number) => onChange({ eq: recipe.eq.map((value, position) => (position === index ? gain : value)) }, `eq${index}`);
  return (
    <Section
      title="Ecualizador"
      text="Sube o baja cada zona del sonido con el control o escribiendo los dB. Cambios pequeños (2 a 4 dB) suelen bastar."
      className="lg:col-span-2 xl:col-span-7"
      actions={
        <Button size="sm" variant="secondary" onClick={() => onChange({ eq: recipe.eq.map(() => 0) }, "eq")} disabled={flat}>
          Dejar plano
        </Button>
      }
    >
      <EqCurve eq={recipe.eq} lowcut={recipe.lowcut} />
      <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
        {EQ_BANDS.map((band, index) => {
          const gain = recipe.eq[index] ?? 0;
          return (
            <div
              key={band.hz}
              className={cn("flex flex-col items-center rounded-xl border px-1.5 pt-2 pb-2.5 text-center transition", gain ? "border-signal/40 bg-signal-soft/50" : "border-line bg-canvas")}
              onDoubleClick={() => setBand(index, 0)}
              title={`${band.hint}. Doble clic para volver a cero`}
            >
              <span className="text-[12.5px] leading-tight font-semibold text-ink">{band.label}</span>
              <span className="text-[10.5px] text-muted tabular">{frequency(band.hz)}</span>
              <input
                type="range"
                min={-EQ_MAX}
                max={EQ_MAX}
                step={0.5}
                value={gain}
                onChange={(event) => setBand(index, Number(event.target.value))}
                className={cn(rangeClass, "my-3 h-28 w-1.5 [direction:rtl] [writing-mode:vertical-lr]")}
                style={rangeFill(gain, -EQ_MAX, EQ_MAX, 0, "top")}
                aria-label={`${band.label} (${frequency(band.hz)})`}
                aria-valuetext={`${gain > 0 ? "+" : ""}${gain} dB`}
              />
              <NumberField value={gain} min={-EQ_MAX} max={EQ_MAX} step={0.5} digits={1} unit="dB" signed label={`${band.label} en dB`} onCommit={(next) => setBand(index, next)} className="w-full max-w-[5.5rem]" />
              <span className="mt-1.5 hidden text-[10.5px] leading-tight text-muted lg:block">{band.hint}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Styles and every sound control: the same chain the server renders, heard live while playing. */
export function SoundPanel({ recipe, maxGain, targetLufs, onChange, onReplace }: { recipe: Recipe; maxGain: number; targetLufs: number; onChange: Update; onReplace: (recipe: Recipe) => void }) {
  const manual: Update = (patch, group) => onChange({ ...patch, preset: null }, group);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-ink">Estilos de sonido</p>
          <p className="text-[11.5px] text-muted">Un punto de partida en un clic. Luego afina con los controles.</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((preset) => {
            const active = (recipe.preset ?? "natural") === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onReplace(applyPreset(recipe, preset))}
                aria-pressed={active}
                className={cn("rounded-xl border px-3.5 py-2.5 text-left transition", active ? "border-signal bg-signal-soft ring-2 ring-signal/20" : "border-line bg-raised hover:border-line-strong")}
              >
                <span className="block text-[13px] font-semibold text-ink">{preset.name}</span>
                <span className="mt-0.5 block text-[11px] leading-[1.4] text-muted">{preset.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Equalizer recipe={recipe} onChange={manual} />

        <Section title="Volumen y dinámica" text="Para que suene parejo, con cuerpo y al mismo volumen que el resto de la radio." className="xl:col-span-5">
          <div className="space-y-5">
            <Slider
              label="Compresión"
              hint="Empareja lo fuerte y lo suave: las partes bajas se entienden mejor y el audio suena más «de radio»."
              value={recipe.compress}
              min={0}
              max={100}
              unit="%"
              format={(value) => (value ? "Activa" : "Apagada")}
              group="compress"
              onChange={manual}
            />
            <Slider
              label="Volumen"
              hint="Sube o baja todo el audio."
              value={recipe.gain}
              min={-maxGain}
              max={maxGain}
              step={0.5}
              digits={1}
              signed
              unit="dB"
              format={(value) => (value ? (value > 0 ? "Más fuerte" : "Más suave") : "Original")}
              group="gain"
              onChange={manual}
            />
            <div className="rounded-xl bg-canvas p-3">
              <Toggle
                label="Normalizar volumen"
                hint={`Deja el audio al volumen estándar de la radio (${targetLufs} LUFS), medido con precisión al guardar y sin distorsión.`}
                checked={recipe.normalize}
                onChange={(normalize) => manual({ normalize }, "normalize")}
              />
            </div>
          </div>
        </Section>

        <Section title="Voz y estéreo" text="Para cuando la voz suena baja frente a los instrumentos. Funciona en audios estéreo: la voz principal suele ir al centro." className="xl:col-span-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Slider
              label="Resaltar voz"
              hint="Sube lo que suena al centro (la voz) y le da claridad, mientras baja un poco los instrumentos de los lados."
              value={recipe.voice}
              min={0}
              max={100}
              unit="%"
              format={(value) => (value ? "Activo" : "Apagado")}
              group="voice"
              onChange={manual}
            />
            <Slider
              label="Amplitud estéreo"
              hint="A la derecha suena más abierto y envolvente; a la izquierda, más concentrado al centro."
              value={recipe.width}
              min={-100}
              max={100}
              unit="%"
              signed
              format={(value) => (value ? (value > 0 ? "Más abierto" : "Más centrado") : "Original")}
              group="width"
              onChange={manual}
            />
          </div>
        </Section>

        <Section title="Limpieza" text="Para grabaciones con ruido, zumbidos o «eses» que silban." className="xl:col-span-6">
          <div className="space-y-5">
            <div className="rounded-xl bg-canvas p-3">
              <Toggle label="Quitar retumbe" hint="Elimina zumbidos y golpes graves que no son música (debajo de 80 Hz). Limpia sin perder el bajo." checked={recipe.lowcut} onChange={(lowcut) => manual({ lowcut }, "lowcut")} />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Slider
                label="Reducir ruido"
                hint="Quita soplido, siseo y ruido constante. Con moderación: demasiado vuelve el sonido metálico."
                value={recipe.denoise}
                min={0}
                max={100}
                unit="%"
                format={(value) => (value ? "Activo" : "Apagado")}
                group="denoise"
                onChange={manual}
                badge={<FinalOnly />}
              />
              <Slider
                label="Suavizar «eses»"
                hint="Baja los silbidos de las «s» y «ch» que molestan en voces brillantes."
                value={recipe.deess}
                min={0}
                max={100}
                unit="%"
                format={(value) => (value ? "Activo" : "Apagado")}
                group="deess"
                onChange={manual}
                badge={<FinalOnly />}
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
