import { usePage } from "@inertiajs/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Modal } from "@/Components/ui/modal";
import { cn } from "@/lib/cn";
import type { SharedProps } from "@/types";

/** Opens the platform policies. The button text is the phrase the reader accepts. */
export function PoliciesLink({ children, className }: { children: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink", className)}>
        {children}
      </button>
      <PoliciesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Short notice for every footer: the platform does not answer for what each channel broadcasts. */
export function ContentDisclaimer({ className }: { className?: string }) {
  const { app } = usePage<SharedProps>().props;
  return (
    <p className={cn("text-xs leading-relaxed text-faint", className)}>
      © {new Date().getFullYear()} {app.name}. Plataforma de canales en streaming. {app.name} no se hace responsable de los audios, la música ni las canciones que emite el administrador de cada canal, ni de las licencias, autorizaciones o derechos de autor que esas emisiones requieran.{" "}
      <PoliciesLink className="text-muted">Cómo trabajamos</PoliciesLink>
    </p>
  );
}

export function PoliciesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app } = usePage<SharedProps>().props;
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Cómo trabaja la plataforma" description={`Políticas de trabajo, privacidad y derechos de autor de ${app.name}.`}>
      <div className="max-h-[min(32rem,70vh)] space-y-6 overflow-y-auto pr-1 text-sm leading-relaxed text-muted">
        <Section title="Una plataforma de canales">
          {app.name} opera una plataforma de streaming. Cada canal lo conduce su propio administrador: elige qué suena, cuándo sale al aire y qué dice en su transmisión. Nosotros damos la herramienta —el canal, la consola, la audiencia y los pagos— y no producimos ni seleccionamos el contenido de cada canal.
        </Section>
        <Section title="Seriedad al entregar un canal">
          Quien pide un canal presenta un expediente con su identidad y su proyecto. El equipo de la plataforma lo revisa y puede pedir más información, aprobarlo o rechazarlo. Aprobar un canal no es un aval del contenido que después se emita: es la decisión de dejar operar la herramienta a una persona identificada, que responde por lo que transmite.
        </Section>
        <Section title="Privacidad">
          Los datos y documentos de una solicitud se usan para verificar la identidad, evaluar el proyecto y, si se aprueba, administrar el canal. Se guardan en un almacenamiento privado, al que accede el personal autorizado, y no se venden ni se ceden a terceros salvo obligación legal. Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición desde tu cuenta, conforme a la Ley N.º 29733.
        </Section>
        <Section title="Música, licencias y derechos de autor">
          El administrador de cada canal es el único responsable de los audios, la música y las canciones que emite, y de contar con las licencias, autorizaciones y derechos que esa emisión exija. {app.name} no otorga, no gestiona y no garantiza esas licencias. No revisamos el catálogo de cada canal ni respondemos por reclamos de autores, productores, sellos o sociedades de gestión sobre lo que un administrador ponga al aire.
        </Section>
        <Section title="Qué aceptas al pedir un canal">
          Al marcar la casilla declaras que leíste estas políticas, que transmitirás solo contenido para el que tengas derecho y que {app.name} no asume la responsabilidad por la música, los audios ni las licencias de tu canal.
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p>{children}</p>
    </section>
  );
}
