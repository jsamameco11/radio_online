import { router, usePage } from "@inertiajs/react";
import { ArrowUpRight, ClipboardCheck, FileCheck2, Gift, Hourglass, Mic2, RadioTower, ShieldCheck, Sparkles, X } from "lucide-react";
import { ApplicationWizard } from "@/Components/applications/application-wizard";
import type { FreeFrequency } from "@/Components/site/frequency-picker";
import { Badge } from "@/Components/ui/badge";
import type { Tone } from "@/Components/ui/badge";
import { buttonClasses } from "@/Components/ui/button";
import { Panel } from "@/Components/ui/panel";
import SiteLayout from "@/Layouts/SiteLayout";
import { dateTime } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { ApplicationLimits, ApplicationOptions } from "@/types/applications";
import type { CategoryGroup, DialBand, FrequencyRequestItem } from "@/types/site";

interface CreateStationProps {
  frequencies: FreeFrequency[];
  band: DialBand;
  categories: CategoryGroup[];
  maxCategories: number;
  open: boolean;
  options: ApplicationOptions;
  limits: ApplicationLimits;
  requests: FrequencyRequestItem[];
  hasPending: boolean;
  myStations: { id: number; display_name: string; role: string; studio_url: string; public_url: string }[];
  preselected: string | null;
}

const statusTone: Record<FrequencyRequestItem["status"], Tone> = { pending: "warning", approved: "onair", rejected: "danger", cancelled: "neutral" };

const perks = [
  { icon: RadioTower, title: "Tu propia frecuencia", text: "Un número fijo en el dial que tus oyentes recordarán, como en la radio de siempre." },
  { icon: Mic2, title: "Estudio en el navegador", text: "Consola en vivo, piloto automático, programación, biblioteca y episodios." },
  { icon: Gift, title: "Gana dinero transmitiendo", text: "Tus oyentes te envían regalos durante tus transmisiones y tú retiras lo que ganas." },
];

const process = [
  { icon: ClipboardCheck, title: "Completa tu expediente", text: "Tus datos, documentos y el proyecto de tu radio, en cinco pasos." },
  { icon: ShieldCheck, title: "Lo revisamos", text: "Verificamos tu identidad y evaluamos tu propuesta." },
  { icon: FileCheck2, title: "Sales al aire", text: "Si la aprobamos, tu estudio queda listo en tu frecuencia." },
];

export default function CreateStation({ requests, hasPending, myStations, open, ...wizard }: CreateStationProps) {
  const { auth } = usePage<SharedProps>().props;

  return (
    <SiteLayout title="Obtén tu frecuencia">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-surface sm:p-12">
          <div className="relative max-w-2xl space-y-4">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-signal uppercase">
              <Sparkles className="size-4" /> Obtén tu frecuencia
            </p>
            <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">Tu voz merece una frecuencia.</h1>
            <p className="text-surface/70">
              Cada radio de la plataforma tiene un responsable verificado. Completa tu solicitud con tus datos, tus documentos y el proyecto de tu radio; nuestro equipo la revisará con cuidado.
            </p>
          </div>
          <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
            {perks.map((perk) => (
              <div key={perk.title} className="rounded-2xl bg-surface/10 p-4 ring-1 ring-surface/15">
                <perk.icon className="size-5 text-signal" />
                <p className="mt-3 font-semibold">{perk.title}</p>
                <p className="mt-1 text-sm text-surface/70">{perk.text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            {hasPending ? (
              <Panel title="Tus solicitudes están en revisión">
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                    <Hourglass className="size-5" aria-hidden />
                  </span>
                  <p className="text-sm text-muted">Llegaste al número de solicitudes que puedes tener en revisión a la vez. Te avisaremos por correo cuando tengamos una respuesta; mientras tanto puedes seguir su estado aquí.</p>
                </div>
              </Panel>
            ) : !open ? (
              <Panel title="Las solicitudes están cerradas por ahora">
                <p className="text-sm text-muted">Estamos preparando nuevas frecuencias. Vuelve pronto para enviar tu solicitud.</p>
              </Panel>
            ) : (
              <Panel title="Solicitud de radio" description="Todos los campos son obligatorios salvo los marcados como opcionales. Guardamos tu avance en este dispositivo, sin tus documentos.">
                <ApplicationWizard {...wizard} draftKey={`crear-mi-radio:${auth.user?.id ?? "invitado"}`} />
              </Panel>
            )}
          </div>

          <aside className="space-y-4">
            {myStations.length > 0 && (
              <Panel title="Tus radios" padded={false}>
                <ul className="divide-y divide-line">
                  {myStations.map((station) => (
                    <li key={station.id} className="space-y-2 px-5 py-4">
                      <p className="font-display font-semibold">{station.display_name}</p>
                      <p className="text-xs text-muted">{station.role}</p>
                      <div className="flex gap-2">
                        <a href={station.studio_url} className={buttonClasses("primary", "sm")}>
                          <Mic2 className="size-3.5" /> Abrir estudio
                        </a>
                        <a href={station.public_url} className={buttonClasses("ghost", "sm")}>
                          Ver página <ArrowUpRight className="size-3.5" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Mis solicitudes" padded={false}>
              {requests.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">Aún no enviaste ninguna solicitud.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {requests.map((request) => (
                    <li key={request.id} className="space-y-1.5 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">
                          <span className="font-display tabular">{request.frequency.display}</span> · {request.station_name}
                        </p>
                        <Badge tone={statusTone[request.status]}>{request.status_label}</Badge>
                      </div>
                      <p className="text-xs text-faint">
                        Enviada el {dateTime(request.created_at, { dateStyle: "medium" })}
                        {request.reviewed_at && ` · revisada el ${dateTime(request.reviewed_at, { dateStyle: "medium" })}`}
                      </p>
                      {request.review_note && <p className="rounded-xl bg-raised px-3 py-2 text-xs text-muted">{request.review_note}</p>}
                      {request.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("¿Cancelar tu solicitud? Eliminaremos los documentos que enviaste.")) {
                              router.delete(`/obten-tu-frecuencia/solicitudes/${request.id}`, { preserveScroll: true });
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
                        >
                          <X className="size-3.5" /> Cancelar solicitud
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Cómo funciona">
              <ol className="space-y-4">
                {process.map((item, index) => (
                  <li key={item.title} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-muted ring-1 ring-line">
                      <item.icon className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">
                        {index + 1}. {item.title}
                      </span>
                      <span className="block text-xs text-muted">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
