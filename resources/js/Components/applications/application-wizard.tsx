import { useForm } from "@inertiajs/react";
import { ArrowLeft, ArrowRight, Building2, CreditCard, Lock, Pencil, Save, Send, Trash2 } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApplicationForm, Errors } from "@/Components/applications/application-form";
import { adultCutoff, clearDraft, emptyForm, loadDraft, pickAges, saveDraft, scheduleHours, stepOf, steps, validateStep } from "@/Components/applications/application-form";
import { AudiencePicker } from "@/Components/applications/audience-picker";
import { ChoiceChips } from "@/Components/applications/choice-chips";
import { FileDrop } from "@/Components/applications/file-drop";
import { WizardProgress } from "@/Components/applications/wizard-progress";
import { CategoryPicker } from "@/Components/forms/category-picker";
import { fieldError } from "@/Components/forms/field-error";
import { PoliciesLink } from "@/Components/legal/platform-policies";
import type { FreeFrequency } from "@/Components/site/frequency-picker";
import { FrequencyPicker } from "@/Components/site/frequency-picker";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { bytes, dateTime, money } from "@/lib/format";
import type { ApplicationLimits, ApplicationOptions } from "@/types/applications";
import type { CategoryGroup, DialBand } from "@/types/site";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PDF = ["application/pdf"];

type TextField = { [K in keyof ApplicationForm]: ApplicationForm[K] extends string ? K : never }[keyof ApplicationForm];

const networkLabels: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X (Twitter)" };

interface ApplicationWizardProps {
  frequencies: FreeFrequency[];
  band: DialBand;
  categories: CategoryGroup[];
  maxCategories: number;
  options: ApplicationOptions;
  limits: ApplicationLimits;
  preselected: string | null;
  /** localStorage key of the text draft, per account. */
  draftKey: string;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4">
        <span className="block font-display text-lg font-semibold">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Counter({ value, min, max }: { value: string; min?: number; max: number }) {
  const length = value.trim().length;
  return (
    <span className={cn("tabular", min !== undefined && length < min ? "text-warning" : "text-faint")}>
      {length}/{max}
    </span>
  );
}

function Summary({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
          Editar
        </Button>
      </header>
      <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0 space-y-0.5", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-words whitespace-pre-line text-ink">{value === "" || value === null || value === undefined ? <span className="text-faint">—</span> : value}</dd>
    </div>
  );
}

/** "Obtén tu canal" in five steps: the person in charge, documents, the channel, its content and a final review. */
export function ApplicationWizard({ frequencies, band, categories, maxCategories, options, limits, preselected, draftKey }: ApplicationWizardProps) {
  const context = { limits, options, maxCategories };
  const preselectedId = frequencies.find((frequency) => frequency.slug === preselected)?.id ?? null;
  const form = useForm<ApplicationForm>(() => {
    const draft = loadDraft(draftKey, emptyForm(preselectedId, options.socialNetworks));
    return frequencies.some((item) => item.id === draft.frequency_id) ? draft : { ...draft, frequency_id: null };
  });
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const data = form.data;
  const last = steps.length - 1;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      saveDraft(draftKey, data);
      setSavedAt(new Date());
    }, 800);
    return () => window.clearTimeout(timer);
  }, [data, draftKey]);

  const failing = useMemo(() => [...new Set(Object.keys(errors).map(stepOf))], [errors]);
  const error = (...keys: string[]) => fieldError(errors, ...keys);

  const patch = (changes: Partial<ApplicationForm>) => {
    form.setData((current) => ({ ...current, ...changes }));
    const touched = Object.keys(changes);
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !touched.some((field) => key === field || key.startsWith(`${field}.`)))));
  };

  const text = (field: TextField) => (event: { target: { value: string } }) => patch({ [field]: event.target.value });

  const go = (index: number) => {
    setStep(index);
    setReached((current) => Math.max(current, index));
    window.requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const next = () => {
    const found = validateStep(step, data, context);
    if (Object.keys(found).length > 0) {
      setErrors((current) => ({ ...current, ...found }));
      window.requestAnimationFrame(() => top.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    go(step + 1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step < last) {
      next();
      return;
    }
    const found = steps.reduce<Errors>((all, _, index) => ({ ...all, ...validateStep(index, data, context) }), {});
    if (Object.keys(found).length > 0) {
      setErrors(found);
      go(Math.min(...Object.keys(found).map(stepOf)));
      return;
    }
    form.post("/obten-tu-frecuencia", {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => clearDraft(draftKey),
      onError: (received) => {
        setErrors(received);
        go(Math.min(...Object.keys(received).map(stepOf)));
      },
    });
  };

  const discardDraft = () => {
    clearDraft(draftKey);
    form.setData(emptyForm(preselectedId, options.socialNetworks));
    setErrors({});
    setSavedAt(null);
    go(0);
  };

  const label = (list: { value: string; label: string }[], value: string) => list.find((item) => item.value === value)?.label ?? value;
  const documentType = options.documentTypes.find((item) => item.value === data.document_type);
  const frequency = frequencies.find((item) => item.id === data.frequency_id);
  const categoryNames = categories.flatMap((group) => group.categories).filter((category) => data.category_ids.includes(category.id));
  const uploads = [data.photo, data.document_front, data.document_back, data.resume, ...data.certificates].filter((file): file is File => file !== null);
  const audienceTags = options.audienceTags.flatMap((group) => group.options);
  const schedule = data.schedule_start_hour !== "" && data.schedule_end_hour !== "" ? `de ${label(scheduleHours, data.schedule_start_hour)} a ${label(scheduleHours, data.schedule_end_hour)}` : "";

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <div ref={top} className="scroll-mt-24">
        <WizardProgress steps={steps} current={step} reached={reached} failing={failing} onSelect={go} />
      </div>

      {step === 0 && (
        <div className="space-y-10">
          <Section title="Datos personales" description="Tal como figuran en tu documento de identidad.">
            <Field label="Nombres" error={error("first_names")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.first_names} onChange={text("first_names")} maxLength={80} autoComplete="given-name" />}
            </Field>
            <Field label="Apellidos" error={error("last_names")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.last_names} onChange={text("last_names")} maxLength={80} autoComplete="family-name" />}
            </Field>
            <Field label="Tipo de documento" error={error("document_type")}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={data.document_type} onChange={text("document_type")}>
                  {options.documentTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Número de documento" error={error("document_number")} hint={`${documentType?.hint ?? ""} No lo guardamos en este dispositivo.`}>
              {(id, invalid) => (
                <Input
                  id={id}
                  invalid={invalid}
                  value={data.document_number}
                  onChange={text("document_number")}
                  maxLength={20}
                  inputMode={data.document_type === "dni" ? "numeric" : "text"}
                  autoComplete="off"
                  className="tabular uppercase"
                />
              )}
            </Field>
            <Field label="Nacionalidad" error={error("nationality")}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={data.nationality} onChange={text("nationality")}>
                  {options.countries.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Fecha de nacimiento" error={error("birth_date")} hint={`Debes tener ${limits.minAge} años o más.`}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="date" value={data.birth_date} onChange={text("birth_date")} max={adultCutoff(limits.minAge)} min="1900-01-01" autoComplete="bday" />}
            </Field>
            <Field label="Teléfono con código de país" error={error("phone")} hint="Por ejemplo +51 987 654 321. Te llamaremos solo por tu solicitud.">
              {(id, invalid) => <Input id={id} invalid={invalid} type="tel" value={data.phone} onChange={text("phone")} maxLength={24} autoComplete="tel" className="tabular" />}
            </Field>
          </Section>

          <Section title="Residencia">
            <Field label="País" error={error("country")}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={data.country} onChange={text("country")}>
                  {options.countries.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Región o departamento" error={error("region")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.region} onChange={text("region")} maxLength={80} autoComplete="address-level1" />}
            </Field>
            <Field label="Ciudad o distrito" error={error("city")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.city} onChange={text("city")} maxLength={80} autoComplete="address-level2" />}
            </Field>
            <Field label="Dirección" error={error("address")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.address} onChange={text("address")} maxLength={200} autoComplete="street-address" />}
            </Field>
          </Section>

          <Section title="Formación y experiencia" description="Nos ayuda a conocer a quien estará al frente del canal.">
            <Field label="Profesión u ocupación" error={error("occupation")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.occupation} onChange={text("occupation")} maxLength={100} placeholder="Comunicador, docente, músico…" />}
            </Field>
            <Field label="Nivel de estudios" error={error("education_level")}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={data.education_level} onChange={text("education_level")}>
                  <option value="">Elige una opción</option>
                  {options.educationLevels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Institución" hint="Opcional." error={error("institution")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.institution} onChange={text("institution")} maxLength={150} />}
            </Field>
            <Field label="Carrera o especialidad" hint="Opcional." error={error("field_of_study")}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.field_of_study} onChange={text("field_of_study")} maxLength={150} />}
            </Field>
            <Field label="Años de experiencia en comunicación o streaming" error={error("experience_years")}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={0} max={60} value={data.experience_years} onChange={text("experience_years")} className="max-w-32 tabular" />}
            </Field>
            <Field
              label="Preséntate"
              error={error("bio")}
              className="sm:col-span-2"
              hint={
                <span className="flex justify-between gap-3">
                  <span>Quién eres y qué experiencia tienes frente a un micrófono o un público.</span>
                  <Counter value={data.bio} min={limits.bioMin} max={limits.bioMax} />
                </span>
              }
            >
              {(id, invalid) => <Textarea id={id} invalid={invalid} rows={4} maxLength={limits.bioMax} value={data.bio} onChange={text("bio")} />}
            </Field>
          </Section>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-8">
          <p className="flex items-start gap-3 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            Tus documentos se guardan en un almacenamiento privado. Solo el equipo que revisa solicitudes puede verlos, con enlaces que caducan en minutos, y nunca se muestran en tu perfil público.
          </p>
          <Field label="Tu foto" error={error("photo")} hint={`De frente, con buena luz, sin lentes oscuros ni filtros. Mínimo ${limits.photoMinPixels} × ${limits.photoMinPixels} px.`}>
            {(id, invalid) => (
              <FileDrop
                id={id}
                title="Foto del rostro"
                files={data.photo ? [data.photo] : []}
                onChange={(files) => patch({ photo: files[0] ?? null })}
                accept={IMAGE_TYPES}
                formats="JPG, PNG o WebP"
                maxKb={limits.photoKb}
                minPixels={limits.photoMinPixels}
                invalid={invalid}
              />
            )}
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Documento de identidad · anverso" error={error("document_front")} hint="Que se lean todos los datos.">
              {(id, invalid) => (
                <FileDrop
                  id={id}
                  title="Cara frontal"
                  files={data.document_front ? [data.document_front] : []}
                  onChange={(files) => patch({ document_front: files[0] ?? null })}
                  accept={[...IMAGE_TYPES, ...PDF]}
                  formats="JPG, PNG, WebP o PDF"
                  maxKb={limits.documentKb}
                  invalid={invalid}
                />
              )}
            </Field>
            <Field label="Documento de identidad · reverso" error={error("document_back")} hint="En pasaportes, la página de datos o la de firma.">
              {(id, invalid) => (
                <FileDrop
                  id={id}
                  title="Cara posterior"
                  files={data.document_back ? [data.document_back] : []}
                  onChange={(files) => patch({ document_back: files[0] ?? null })}
                  accept={[...IMAGE_TYPES, ...PDF]}
                  formats="JPG, PNG, WebP o PDF"
                  maxKb={limits.documentKb}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>
          <Field label="Currículum y estudios" error={error("resume")} hint="Un solo PDF con tu experiencia y tus estudios.">
            {(id, invalid) => (
              <FileDrop
                id={id}
                title="Currículum en PDF"
                files={data.resume ? [data.resume] : []}
                onChange={(files) => patch({ resume: files[0] ?? null })}
                accept={PDF}
                formats="PDF"
                maxKb={limits.resumeKb}
                invalid={invalid}
              />
            )}
          </Field>
          <Field label={`Certificados adicionales (opcional, hasta ${limits.maxCertificates})`} error={error("certificates")} hint="Cursos de locución, periodismo, producción…">
            {(id, invalid) => (
              <FileDrop
                id={id}
                title="Certificados en PDF"
                files={data.certificates}
                onChange={(files) => patch({ certificates: files })}
                accept={PDF}
                formats="PDF"
                maxKb={limits.certificateKb}
                max={limits.maxCertificates}
                invalid={invalid}
              />
            )}
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
          <Field label="Nombre del canal" error={error("station_name")} hint="Así aparecerá junto al número de tu canal.">
            {(id, invalid) => <Input id={id} invalid={invalid} value={data.station_name} onChange={text("station_name")} maxLength={80} placeholder="Radio Aurora" />}
          </Field>
          <Field label="Canal" error={error("frequency_id")} hint={`${frequencies.length} canales libres ahora mismo. Queda libre hasta que aprobemos tu solicitud.`}>
            {(_, invalid) => <FrequencyPicker frequencies={frequencies} band={band} value={data.frequency_id} onChange={(id) => patch({ frequency_id: id })} invalid={invalid} />}
          </Field>
          <Field label={`Categorías (hasta ${maxCategories})`} error={error("category_ids")}>
            {() => <CategoryPicker groups={categories} value={data.category_ids} onChange={(value) => patch({ category_ids: value })} max={maxCategories} />}
          </Field>
          <Field label={`Idiomas de tus transmisiones (hasta ${limits.maxLanguages})`} error={error("languages")}>
            {(_, invalid) => <ChoiceChips label="Idiomas" options={options.languages} value={data.languages} onChange={(value) => patch({ languages: value })} max={limits.maxLanguages} invalid={invalid} />}
          </Field>
          <div className="space-y-4 rounded-2xl border border-line p-4">
            <Switch
              checked={data.represents_organization}
              onChange={(checked) => patch({ represents_organization: checked })}
              label={
                <span className="inline-flex items-center gap-2">
                  <Building2 className="size-4 text-muted" aria-hidden /> Represento a una organización
                </span>
              }
              description="Empresa, asociación, iglesia, colegio, municipalidad…"
            />
            {data.represents_organization && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre de la organización" error={error("organization_name")} className="sm:col-span-2">
                  {(id, invalid) => <Input id={id} invalid={invalid} value={data.organization_name} onChange={text("organization_name")} maxLength={150} autoComplete="organization" />}
                </Field>
                <Field label="RUC o identificación tributaria" hint="Opcional." error={error("organization_tax_id")}>
                  {(id, invalid) => <Input id={id} invalid={invalid} value={data.organization_tax_id} onChange={text("organization_tax_id")} maxLength={20} className="tabular uppercase" />}
                </Field>
                <Field label="Sitio web" hint="Opcional." error={error("organization_website")}>
                  {(id, invalid) => <Input id={id} invalid={invalid} type="url" value={data.organization_website} onChange={text("organization_website")} placeholder="https://" />}
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <Field label="¿Qué contenido producirás?" error={error("content_types")} hint="Elige todos los que apliquen.">
            {(_, invalid) => <ChoiceChips label="Tipos de contenido" options={options.contentTypes} value={data.content_types} onChange={(value) => patch({ content_types: value })} invalid={invalid} />}
          </Field>
          <Field
            label="¿Para qué quieres tu canal?"
            error={error("purpose")}
            hint={
              <span className="flex justify-between gap-3">
                <span>Tu propuesta, qué aportará a tus oyentes y por qué ahora. Mínimo {limits.purposeMin} caracteres.</span>
                <Counter value={data.purpose} min={limits.purposeMin} max={limits.purposeMax} />
              </span>
            }
          >
            {(id, invalid) => <Textarea id={id} invalid={invalid} rows={6} maxLength={limits.purposeMax} value={data.purpose} onChange={text("purpose")} />}
          </Field>
          <Section title="¿A quién te diriges?" description="Define a tu audiencia: nos ayuda a evaluar tu propuesta y a recomendar tu canal a quien le interesa.">
            <Field label="Edades" hint="Elige todos los rangos que apliquen." error={error("audience_ages")} className="sm:col-span-2">
              {(_, invalid) => (
                <ChoiceChips label="Rangos de edad" options={options.audienceAges} value={data.audience_ages} onChange={(value) => patch({ audience_ages: pickAges(data.audience_ages, value) })} invalid={invalid} />
              )}
            </Field>
            <Field label="Tipo de público" hint={`Hasta ${limits.maxAudienceTags}: quiénes son, dónde viven, qué escuchan y qué les interesa.`} error={error("audience_tags")} className="sm:col-span-2">
              {(_, invalid) => <AudiencePicker groups={options.audienceTags} value={data.audience_tags} onChange={(value) => patch({ audience_tags: value })} max={limits.maxAudienceTags} invalid={invalid} />}
            </Field>
          </Section>
          <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <Field label="Horas por semana" error={error("hours_per_week")}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={1} max={168} value={data.hours_per_week} onChange={text("hours_per_week")} className="tabular" />}
            </Field>
            <Field label="Días de transmisión" error={error("broadcast_days")}>
              {(_, invalid) => <ChoiceChips label="Días de transmisión" options={options.weekdays} value={data.broadcast_days} onChange={(value) => patch({ broadcast_days: value })} invalid={invalid} />}
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Horario previsto</legend>
            <p className="text-sm text-muted">Opcional. Si emitirás de madrugada, elige una hora de fin menor que la de inicio (por ejemplo, de 22:00 a 02:00).</p>
            <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
              {(
                [
                  ["schedule_start_hour", "Desde"],
                  ["schedule_end_hour", "Hasta"],
                ] as const
              ).map(([field, title]) => (
                <Field key={field} label={title} error={error(field)}>
                  {(id, invalid) => (
                    <Select id={id} invalid={invalid} value={data[field]} onChange={text(field)} className="tabular">
                      <option value="">Sin definir</option>
                      {scheduleHours.map((hour) => (
                        <option key={hour.value} value={hour.value}>
                          {hour.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ))}
            </div>
          </fieldset>
          <Section title="Redes y muestras" description="Opcional. Nos ayuda a conocer tu trabajo.">
            {options.socialNetworks.map((network) => (
              <Field key={network} label={networkLabels[network] ?? network} error={error(`social_links.${network}`)}>
                {(id, invalid) => (
                  <Input
                    id={id}
                    invalid={invalid}
                    type="url"
                    value={data.social_links[network] ?? ""}
                    onChange={(event) => patch({ social_links: { ...data.social_links, [network]: event.target.value } })}
                    placeholder="https://"
                  />
                )}
              </Field>
            ))}
            <Field label="Enlace a una muestra o demo" hint="Un audio, video o programa tuyo." error={error("demo_url")}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="url" value={data.demo_url} onChange={text("demo_url")} placeholder="https://" />}
            </Field>
          </Section>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <Summary title="Responsable" onEdit={() => go(0)}>
            <Item label="Nombre completo" value={`${data.first_names} ${data.last_names}`.trim()} />
            <Item label="Documento" value={`${documentType?.label ?? ""} ${data.document_number}`.trim()} />
            <Item label="Nacionalidad" value={label(options.countries, data.nationality)} />
            <Item label="Fecha de nacimiento" value={data.birth_date ? dateTime(`${data.birth_date}T12:00:00`, { dateStyle: "long" }) : ""} />
            <Item label="Teléfono" value={data.phone} />
            <Item label="Residencia" value={[data.address, data.city, data.region, label(options.countries, data.country)].filter(Boolean).join(", ")} />
            <Item label="Ocupación" value={data.occupation} />
            <Item label="Estudios" value={[label(options.educationLevels, data.education_level), data.field_of_study, data.institution].filter(Boolean).join(" · ")} />
            <Item label="Experiencia" value={data.experience_years === "" ? "" : `${data.experience_years} años`} />
            <Item label="Presentación" value={data.bio} wide />
          </Summary>
          <Summary title="Documentos" onEdit={() => go(1)}>
            <div className="sm:col-span-2">
              <ul className="divide-y divide-line">
                {uploads.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted tabular">{bytes(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Summary>
          <Summary title="Tu canal" onEdit={() => go(2)}>
            <Item label="Nombre" value={data.station_name} />
            <Item label="Canal" value={frequency ? `${frequency.label} ${band.name}${frequency.price_cents !== null ? ` · premium ${money(frequency.price_cents)}` : ""}` : ""} />
            <Item
              label="Categorías"
              value={
                categoryNames.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {categoryNames.map((category) => (
                      <Badge key={category.id}>{category.name}</Badge>
                    ))}
                  </span>
                )
              }
            />
            <Item label="Idiomas" value={data.languages.map((code) => label(options.languages, code)).join(", ")} />
            <Item
              label="Organización"
              value={data.represents_organization ? [data.organization_name, data.organization_tax_id && `RUC ${data.organization_tax_id}`, data.organization_website].filter(Boolean).join(" · ") : "No, a título personal"}
              wide
            />
          </Summary>
          <Summary title="Contenido y propósito" onEdit={() => go(3)}>
            <Item label="Contenido" value={data.content_types.map((type) => label(options.contentTypes, type)).join(", ")} />
            <Item label="Emisión" value={[data.hours_per_week && `${data.hours_per_week} h por semana`, data.broadcast_days.map((day) => label(options.weekdays, day)).join(", "), schedule].filter(Boolean).join(" · ")} />
            <Item label="Para qué quieres tu canal" value={data.purpose} wide />
            <Item label="Edades" value={data.audience_ages.map((age) => label(options.audienceAges, age)).join(", ")} wide />
            <Item
              label="Público"
              value={
                data.audience_tags.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {data.audience_tags.map((tag) => (
                      <Badge key={tag}>{label(audienceTags, tag)}</Badge>
                    ))}
                  </span>
                )
              }
              wide
            />
            <Item
              label="Enlaces"
              value={[...Object.values(data.social_links), data.demo_url].filter((link) => link.trim() !== "").join("\n")}
              wide
            />
          </Summary>

          {frequency && frequency.price_cents !== null && (
            <div className="flex gap-3 rounded-2xl border border-gold/30 bg-gold-soft p-5">
              <CreditCard className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-ink">
                  {frequency.label} {band.name} es un canal premium de {money(frequency.price_cents)}
                </p>
                <p className="text-muted">
                  Al enviar la solicitud registrarás tu tarjeta en la pasarela segura de Culqi. No te cobramos nada ahora: el cobro se hace solo si aprobamos tu solicitud, y en ese momento se abre tu canal. Si la rechazamos o la cancelas, eliminamos tu tarjeta.
                </p>
              </div>
            </div>
          )}

          <fieldset className="space-y-4 rounded-2xl border border-line bg-raised p-5">
            <legend className="sr-only">Declaraciones y consentimiento</legend>
            <details className="text-sm text-muted">
              <summary className="cursor-pointer font-medium text-ink">Términos de la solicitud y tratamiento de datos personales</summary>
              <div className="mt-3 space-y-2">
                <p>
                  Tu solicitud no garantiza la asignación de un canal. El equipo de la plataforma evalúa cada expediente y puede pedirte información adicional, aprobarlo o rechazarlo con una nota.
                </p>
                <p>
                  Conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su reglamento, tus datos y documentos se usan solo para verificar tu identidad, evaluar la solicitud y administrar el canal si es aprobado. Se guardan en un almacenamiento
                  privado al que accede únicamente el personal autorizado y no se comparten con terceros salvo obligación legal.
                </p>
                <p>
                  Si cancelas tu solicitud borramos tus documentos de inmediato; si es rechazada, a los {limits.retentionDays} días. Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiéndonos desde tu cuenta.
                </p>
              </div>
            </details>
            {(
              [
                ["accept_terms", "Leí y acepto los términos de la solicitud."],
                ["declare_truthful", "Declaro que la información y los documentos que envío son verdaderos y me pertenecen."],
                ["consent_data_processing", "Autorizo el tratamiento de mis datos personales para evaluar esta solicitud (Ley N.º 29733)."],
              ] as const
            ).map(([field, statement]) => (
              <div key={field} className="space-y-1">
                <Checkbox label={statement} checked={data[field]} onChange={(event) => patch({ [field]: event.target.checked })} aria-invalid={Boolean(errors[field]) || undefined} />
                {errors[field] && (
                  <p className="pl-6.5 text-xs text-danger" role="alert">
                    {errors[field]}
                  </p>
                )}
              </div>
            ))}
            <div className="space-y-1">
              <div className="flex items-start gap-2.5 text-sm text-ink">
                <input
                  id="accept_broadcast_policy"
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-line-strong accent-[var(--ink)]"
                  checked={data.accept_broadcast_policy}
                  onChange={(event) => patch({ accept_broadcast_policy: event.target.checked })}
                  aria-invalid={Boolean(errors.accept_broadcast_policy) || undefined}
                />
                <p>
                  <label htmlFor="accept_broadcast_policy" className="cursor-pointer">
                    Acepto las
                  </label>{" "}
                  <PoliciesLink>políticas de trabajo, privacidad y derechos de autor</PoliciesLink>
                  <label htmlFor="accept_broadcast_policy" className="cursor-pointer">
                    . Como empresa de canales, no nos hacemos responsables de la música, los audios ni las licencias que requiera lo que emita cada administrador.
                  </label>
                </p>
              </div>
              {errors.accept_broadcast_policy && (
                <p className="pl-6.5 text-xs text-danger" role="alert">
                  {errors.accept_broadcast_policy}
                </p>
              )}
            </div>
          </fieldset>
        </div>
      )}

      {form.processing && form.progress?.percentage !== undefined && (
        <div className="space-y-1.5" aria-live="polite">
          <ProgressBar value={form.progress.percentage / 100} />
          <p className="text-xs text-muted tabular">Subiendo tu expediente… {form.progress.percentage}%</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <div className="flex items-center gap-3 text-xs text-faint">
          {savedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Save className="size-3.5" aria-hidden /> Borrador guardado en este dispositivo a las {dateTime(savedAt.toISOString(), { timeStyle: "short" })}
            </span>
          )}
          <button type="button" onClick={discardDraft} className="inline-flex items-center gap-1 font-medium text-muted hover:text-danger">
            <Trash2 className="size-3.5" aria-hidden /> Empezar de nuevo
          </button>
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => go(step - 1)} disabled={form.processing}>
              Anterior
            </Button>
          )}
          {step < last ? (
            <Button type="submit" icon={<ArrowRight className="size-4" />}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" variant="signal" loading={form.processing} icon={<Send className="size-4" />}>
              {frequency?.price_cents != null ? "Enviar y registrar tarjeta" : "Enviar solicitud"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
