import { Scissors } from "lucide-react";
import type { ReactNode } from "react";
import { timeline } from "@/lib/media/editor/describe";
import { keeps, preciseTime, type Cut, type Recipe } from "@/lib/media/editor/recipe";
import { Slider, type Update } from "./controls";

interface Props {
  recipe: Recipe;
  duration: number;
  length: number;
  maxFade: number;
  maxJoin: number;
  hasJoins: boolean;
  onChange: Update;
  onListen: (from: number) => void;
  onSelect: (range: Cut) => void;
  onRestore: (range: Cut) => void;
  onRemove: (index: number) => void;
}

function SmallButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-ink/40">
      {children}
    </button>
  );
}

/** How the audio ends up, in order (parts that stay and cuts), and the fades in, out and at the joins. */
export function PartsList({ recipe, duration, length, maxFade, maxJoin, hasJoins, onChange, onListen, onSelect, onRestore, onRemove }: Props) {
  const pieces = timeline(keeps(recipe.cuts, duration), recipe.cuts);
  const fadeMax = Math.max(0.1, Math.min(maxFade, Math.floor((length / 2) * 10) / 10));

  return (
    <div>
      <ol className="space-y-1.5">
        {pieces.map((piece) =>
          piece.cut ? (
            <li key={`c${piece.range[0]}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[13px]">
              <Scissors className="size-4 text-danger" />
              <span className="font-semibold text-danger">Cortado</span>
              <span className="text-muted tabular">
                {preciseTime(piece.range[0])} → {preciseTime(piece.range[1])} · {preciseTime(piece.range[1] - piece.range[0])}
              </span>
              <span className="ml-auto flex flex-wrap gap-1">
                {piece.range[0] > 0 && piece.range[1] < duration && <SmallButton onClick={() => onListen(Math.max(0, piece.range[0] - 3))}>▶ Escuchar el empalme</SmallButton>}
                <SmallButton onClick={() => onSelect(piece.range)}>Seleccionar</SmallButton>
                <SmallButton onClick={() => onRestore(piece.range)}>Recuperar</SmallButton>
                <SmallButton onClick={() => onRemove(recipe.cuts.findIndex((cut) => cut[0] === piece.range[0]))}>Quitar</SmallButton>
              </span>
            </li>
          ) : (
            <li key={`k${piece.range[0]}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-[13px]">
              <span className="size-2.5 rounded-full bg-onair" />
              <span className="font-semibold text-ink">Parte {piece.number}</span>
              <span className="text-muted tabular">
                {preciseTime(piece.range[0])} → {preciseTime(piece.range[1])} · {preciseTime(piece.range[1] - piece.range[0])}
              </span>
              <span className="ml-auto">
                <SmallButton onClick={() => onListen(piece.range[0])}>▶ Escuchar</SmallButton>
              </span>
            </li>
          ),
        )}
      </ol>
      {recipe.cuts.length === 0 && <p className="mt-3 text-xs text-muted">Todavía no hay cortes: el audio suena completo.</p>}

      <div className="mt-5 grid gap-5 rounded-xl border border-line bg-raised p-4 md:grid-cols-3 md:p-5">
        <Slider
          label="Entrada suave"
          hint="El audio empieza desde silencio y sube poco a poco."
          value={Math.min(recipe.fadeIn, fadeMax)}
          min={0}
          max={fadeMax}
          step={0.1}
          digits={1}
          unit="s"
          format={(value) => (value ? "Desde silencio" : "Sin fundido")}
          group="fadeIn"
          onChange={onChange}
        />
        <Slider
          label="Salida suave"
          hint="El final baja poco a poco hasta el silencio. Ideal si cortaste el final."
          value={Math.min(recipe.fadeOut, fadeMax)}
          min={0}
          max={fadeMax}
          step={0.1}
          digits={1}
          unit="s"
          format={(value) => (value ? "Hasta el silencio" : "Sin fundido")}
          group="fadeOut"
          onChange={onChange}
        />
        <Slider
          label="Unión de los cortes"
          hint={hasJoins ? "En cero, corte limpio. Más arriba, las partes se funden una con otra." : "Se usa cuando cortas una parte del medio."}
          value={recipe.join}
          min={0}
          max={maxJoin}
          step={0.05}
          digits={2}
          unit="s"
          format={(value) => (value ? "Fundido" : "Corte limpio")}
          group="join"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
