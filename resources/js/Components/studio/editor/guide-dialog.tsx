import { Modal } from "@/Components/ui/modal";

const STEPS = [
  ["Escucha", "con el botón ▶ o la barra espaciadora. Haz clic en la onda para ir a un punto."],
  ["Selecciona", "arrastrando sobre la onda la parte que sobra: una intro larga, un silencio o una parte del medio."],
  ["Corta", "con «Cortar selección» o la tecla Supr. Al reproducir, el corte se salta solo: escucha cómo queda el empalme."],
  ["Afina", "arrastrando las marcas rojas del corte, y suaviza con la entrada, la salida o la unión de los cortes."],
  ["Mejora el sonido", "con un estilo o los controles; escribe el valor exacto si lo necesitas. Compara con «Original / Editado»."],
  ["Guarda.", "El original queda guardado: podrás reabrir la edición o restaurarlo."],
];

const SHORTCUTS = [
  ["Espacio", "Reproducir / pausar"],
  ["Supr", "Cortar la selección"],
  ["I · O", "Marcar inicio · fin en el cursor"],
  ["L", "Repetir la selección"],
  ["B", "Comparar original / editado"],
  ["+ · −", "Acercar · alejar (o Ctrl + rueda)"],
  ["Inicio · Fin", "Ir al inicio · al final"],
  ["← →", "Mover el cursor 1 s (Mayús: 5 s)"],
  ["Ctrl+Z · Ctrl+Y", "Deshacer · rehacer"],
  ["Esc", "Quitar la selección"],
  ["Mayús + clic", "Extender la selección"],
  ["Doble clic", "Seleccionar un corte · volver un control a cero"],
  ["↑ ↓", "En un valor escrito: subir · bajar (Mayús: ×10)"],
  ["?", "Abrir esta guía"],
];

export function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="xl" title="Guía rápida y atajos">
      <div className="grid gap-6 text-[13px] leading-6 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Paso a paso</p>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map(([title, text], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-[11.5px] font-semibold text-ink tabular">{index + 1}</span>
                <span className="text-muted">
                  <b className="text-ink">{title}</b> {text}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Atajos de teclado</p>
          <dl className="mt-3 divide-y divide-line rounded-xl border border-line">
            {SHORTCUTS.map(([key, text]) => (
              <div key={key} className="flex items-center justify-between gap-4 px-3.5 py-2">
                <dt className="order-last shrink-0">
                  <kbd className="rounded-md border border-line-strong bg-raised px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">{key}</kbd>
                </dt>
                <dd className="text-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Modal>
  );
}
