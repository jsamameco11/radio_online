import { Link, useForm, usePage } from "@inertiajs/react";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, FileText, Lock, ShieldCheck, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { ApprovalFields, approvalDefaults } from "@/Components/admin/approval-fields";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { Avatar } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import type { Tone } from "@/Components/ui/badge";
import { Button, buttonClasses } from "@/Components/ui/button";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, dateTime } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { FreeFrequency, FrequencyRequestRow } from "@/types/admin";
import type { ApplicantAccount, ApplicationDossier, DuplicateApplication } from "@/types/applications";

interface Props {
  request: FrequencyRequestRow;
  application: ApplicationDossier;
  account: ApplicantAccount;
  duplicates: DuplicateApplication[];
  freeFrequencies: FreeFrequency[];
}

const statusTone: Record<FrequencyRequestRow["status"], Tone> = { pending: "warning", approved: "onair", rejected: "danger", cancelled: "neutral" };

const networkLabels: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X" };

function Detail({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "space-y-0.5 sm:col-span-2" : "space-y-0.5"}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-words whitespace-pre-line text-ink">{value === null || value === undefined || value === "" ? <span className="text-faint">—</span> : value}</dd>
    </div>
  );
}

function Details({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">{children}</dl>;
}

function ExternalUrl({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-info hover:underline">
      <span className="truncate">{href}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

export default function ApplicationShow({ request, application, account, duplicates, freeFrequencies }: Props) {
  const { auth } = usePage<SharedProps>().props;
  const [rejecting, setRejecting] = useState(false);
  const photo = application.files.find((file) => file.slug === "foto");
  const documents = application.files.filter((file) => file.slug !== "foto");
  const links = Object.entries(application.social_links);
  const pendingDuplicates = duplicates.filter((item) => item.status === "pending" || item.status === "approved");

  return (
    <AdminLayout title="Expediente">
      <div className="space-y-6">
        <Link href="/admin/solicitudes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Solicitudes
        </Link>
        <PageHeader
          eyebrow={`Expediente · ${request.kind_label}`}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="tabular">{request.frequency.display}</span>
              <span className="text-faint">·</span>
              <span>{request.station_name}</span>
            </span>
          }
          description={`Enviada ${ago(application.submitted_at)} (${dateTime(application.submitted_at)}) por ${application.full_name}.`}
          actions={<Badge tone={statusTone[request.status]}>{request.status_label}</Badge>}
        />

        {duplicates.length > 0 && (
          <div role="alert" className="space-y-2 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" />
              Este documento de identidad aparece en {duplicates.length === 1 ? "otra solicitud" : `${duplicates.length} solicitudes más`}
              {pendingDuplicates.length > 0 && ", con alguna en revisión o aprobada"}.
            </p>
            <ul className="space-y-1">
              {duplicates.map((item) => (
                <li key={item.request_id}>
                  <Link href={`/admin/solicitudes/${item.request_id}/expediente`} className="font-medium underline">
                    {item.frequency} · {item.station_name}
                  </Link>{" "}
                  — {item.applicant}
                  {item.same_account ? " (misma cuenta)" : " (otra cuenta)"} · {item.status_label.toLowerCase()} · {dateTime(item.created_at, { dateStyle: "medium" })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {request.conflict && (
          <p className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle className="size-4" />
            {request.frequency.display} ya no está libre ({request.frequency.status_label.toLowerCase()}). Aprueba con otra frecuencia.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <Panel title="Responsable de la radio">
              <div className="flex flex-col gap-6 sm:flex-row">
                {photo ? (
                  <a href={photo.url} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Abrir la foto">
                    <img src={photo.url} alt={`Foto de ${application.full_name}`} className="size-36 rounded-2xl object-cover ring-1 ring-line" />
                  </a>
                ) : (
                  <Avatar name={application.full_name} size="lg" className="size-36 rounded-2xl text-3xl" />
                )}
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <p className="font-display text-2xl font-semibold">{application.full_name}</p>
                    <p className="text-sm text-muted">
                      {application.age} años · {application.occupation}
                    </p>
                  </div>
                  <Details>
                    <Detail
                      label="Documento"
                      value={
                        <span className="tabular">
                          {application.document.type_label} {application.document.number}
                        </span>
                      }
                    />
                    <Detail label="Nacionalidad" value={application.nationality.label} />
                    <Detail label="Fecha de nacimiento" value={`${dateTime(`${application.birth_date}T12:00:00`, { dateStyle: "long" })} (${application.age} años)`} />
                    <Detail
                      label="Teléfono"
                      value={
                        <a href={`tel:${application.phone}`} className="tabular hover:underline">
                          {application.phone}
                        </a>
                      }
                    />
                    <Detail label="Residencia" value={`${application.city}, ${application.region}, ${application.country.label}`} />
                    <Detail label="Dirección" value={application.address} />
                  </Details>
                </div>
              </div>
            </Panel>

            <Panel title="Formación y experiencia">
              <Details>
                <Detail label="Profesión u ocupación" value={application.occupation} />
                <Detail label="Nivel de estudios" value={application.education_level.label} />
                <Detail label="Institución" value={application.institution} />
                <Detail label="Carrera o especialidad" value={application.field_of_study} />
                <Detail label="Experiencia en radio o comunicación" value={`${application.experience_years} ${application.experience_years === 1 ? "año" : "años"}`} />
                <Detail label="Presentación" value={application.bio} wide />
              </Details>
            </Panel>

            <Panel title="Documentos" description="Cada apertura queda en la auditoría. Los enlaces caducan a los 5 minutos.">
              {application.documents_purged_at ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Lock className="size-4" /> Los documentos se eliminaron el {dateTime(application.documents_purged_at)}.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {documents.map((file) => (
                    <li key={file.slug} className="overflow-hidden rounded-2xl border border-line">
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="block bg-raised">
                        {file.kind === "image" ? (
                          <img src={file.url} alt={file.label} loading="lazy" className="h-44 w-full object-contain" />
                        ) : (
                          <span className="flex h-44 flex-col items-center justify-center gap-2 text-muted">
                            <FileText className="size-10 text-signal" aria-hidden />
                            <span className="text-xs">PDF</span>
                          </span>
                        )}
                      </a>
                      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
                        <span className="truncate text-sm font-medium">{file.label}</span>
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "sm")}>
                          Abrir <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Proyecto de radio">
              <Details>
                <Detail label="Nombre" value={request.station_name} />
                <Detail label="Frecuencia solicitada" value={<span className="tabular">{request.frequency.display}</span>} />
                <Detail
                  label="Categorías"
                  value={
                    request.categories.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {request.categories.map((category) => (
                          <Badge key={category}>{category}</Badge>
                        ))}
                      </span>
                    )
                  }
                />
                <Detail label="Idiomas" value={application.languages.map((item) => item.label).join(", ")} />
                <Detail
                  label="Contenido"
                  value={
                    <span className="flex flex-wrap gap-1.5">
                      {application.content_types.map((item) => (
                        <Badge key={item.value} tone="info">
                          {item.label}
                        </Badge>
                      ))}
                    </span>
                  }
                />
                <Detail
                  label="Emisión prevista"
                  value={[`${application.hours_per_week} h por semana`, application.broadcast_days.map((day) => day.label).join(", "), application.schedule && `de ${application.schedule}`].filter(Boolean).join(" · ")}
                />
                <Detail label="¿Para qué quiere su radio?" value={request.pitch} wide />
                <Detail label="Edades" value={application.audience_ages.map((age) => age.label).join(", ")} wide />
                <Detail
                  label="Público objetivo"
                  wide
                  value={
                    <span className="flex flex-wrap gap-1.5">
                      {application.audience_tags.map((tag) => (
                        <Badge key={tag.value}>{tag.label}</Badge>
                      ))}
                    </span>
                  }
                />
                <Detail
                  label="Organización"
                  wide
                  value={
                    application.organization ? (
                      <span className="space-y-0.5">
                        <span className="block font-medium">{application.organization.name}</span>
                        {application.organization.tax_id && <span className="block text-muted tabular">RUC / ID tributario {application.organization.tax_id}</span>}
                        {application.organization.website && <ExternalUrl href={application.organization.website} />}
                      </span>
                    ) : (
                      "A título personal"
                    )
                  }
                />
                <Detail
                  label="Redes y muestras"
                  wide
                  value={
                    links.length > 0 || application.demo_url ? (
                      <span className="space-y-1">
                        {links.map(([network, url]) => (
                          <span key={network} className="flex gap-2">
                            <span className="w-20 shrink-0 text-muted">{networkLabels[network] ?? network}</span>
                            <ExternalUrl href={url} />
                          </span>
                        ))}
                        {application.demo_url && (
                          <span className="flex gap-2">
                            <span className="w-20 shrink-0 text-muted">Demo</span>
                            <ExternalUrl href={application.demo_url} />
                          </span>
                        )}
                      </span>
                    ) : null
                  }
                />
              </Details>
            </Panel>

            <Panel title="Declaraciones y consentimiento">
              <Details>
                <Detail label="Aceptó los términos" value={dateTime(application.consent.terms_accepted_at)} />
                <Detail label="Declaró que la información es verdadera" value={dateTime(application.consent.truthfulness_declared_at)} />
                <Detail label="Autorizó el tratamiento de datos (Ley 29733)" value={dateTime(application.consent.data_processing_consented_at)} />
                <Detail label="Dirección IP" value={<span className="tabular">{application.consent.ip}</span>} />
              </Details>
            </Panel>
          </div>

          <aside className="space-y-6">
            <Panel title="Decisión">
              {request.status === "pending" ? (
                <ApproveForm request={request} free={freeFrequencies} onReject={() => setRejecting(true)} />
              ) : (
                <div className="space-y-2 text-sm">
                  <Badge tone={statusTone[request.status]}>{request.status_label}</Badge>
                  {request.reviewed_at && (
                    <p className="text-muted">
                      Por {request.reviewer?.name ?? "—"} el {dateTime(request.reviewed_at)}
                    </p>
                  )}
                  {request.review_note && <p className="rounded-xl bg-raised px-3 py-2 text-ink">“{request.review_note}”</p>}
                  {request.station && request.status === "approved" && (
                    <Link href={`/admin/radios/${request.station.id}`} className="inline-block font-medium text-muted hover:text-ink">
                      Ver la radio →
                    </Link>
                  )}
                </div>
              )}
            </Panel>

            <Panel title="Cuenta del solicitante">
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={account.name} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="truncate text-xs text-muted">{account.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={account.status === "active" ? "onair" : "danger"}>{account.status_label}</Badge>
                  {account.email_verified ? (
                    <Badge tone="info">
                      <ShieldCheck className="size-3" /> Correo verificado
                    </Badge>
                  ) : (
                    <Badge tone="warning">Correo sin verificar</Badge>
                  )}
                </div>
                <Details>
                  <Detail label="Cuenta creada" value={dateTime(account.created_at, { dateStyle: "medium" })} />
                  <Detail label="Solicitudes de radio" value={String(account.requests)} />
                  <Detail label="Equipos de radio" value={String(account.stations)} />
                </Details>
                {auth.user?.permissions.includes("users.view") && (
                  <Link href={`/admin/usuarios/${account.id}`} className={buttonClasses("secondary", "sm")}>
                    Ver usuario
                  </Link>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>

      {rejecting && (
        <ReasonModal
          open
          onClose={() => setRejecting(false)}
          title={`Rechazar ${request.station_name}`}
          description="La persona recibirá esta nota por correo. Sus documentos se eliminarán automáticamente pasado el plazo de conservación."
          url={`/admin/solicitudes/${request.id}/rechazar`}
          field="note"
          label="Nota para quien la envió"
          confirmLabel="Rechazar solicitud"
        />
      )}
    </AdminLayout>
  );
}

function ApproveForm({ request, free, onReject }: { request: FrequencyRequestRow; free: FreeFrequency[]; onReject: () => void }) {
  const form = useForm(approvalDefaults(request.frequency.label, request.conflict, free));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/solicitudes/${request.id}/aprobar`, { preserveScroll: true });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ApprovalFields
        requestedLabel={request.frequency.label}
        requestedDisplay={request.frequency.display}
        conflict={request.conflict}
        free={free}
        frequency={form.data.frequency}
        note={form.data.note}
        errors={form.errors}
        onFrequency={(value) => form.setData("frequency", value)}
        onNote={(value) => form.setData("note", value)}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={form.processing} disabled={form.data.frequency === ""} icon={<Check className="size-4" />} className="flex-1">
          Aprobar
        </Button>
        <Button variant="ghost" icon={<X className="size-4" />} onClick={onReject}>
          Rechazar
        </Button>
      </div>
    </form>
  );
}
