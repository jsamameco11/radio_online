import { router, useForm, usePage } from "@inertiajs/react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef } from "react";
import { CategoryPicker } from "@/Components/forms/category-picker";
import { fieldError } from "@/Components/forms/field-error";
import { HashtagInput } from "@/Components/forms/hashtag-input";
import { PageErrors } from "@/Components/forms/page-errors";
import { stationArtwork } from "@/Components/site/station-card";
import { FrequencyTitle, StationLogo } from "@/Components/station/station-identity";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Textarea } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import type { SharedProps } from "@/types";
import type { Option } from "@/types/admin";
import type { CategoryGroupOption, SocialLinks } from "@/types/station-admin";

type ImageSlot = "logo" | "cover";

interface Props {
  profile: {
    tagline: string;
    description: string;
    accent_color: string;
    language: string;
    country: string;
    categories: number[];
    hashtags: string[];
    links: SocialLinks;
  };
  categoryGroups: CategoryGroupOption[];
  languages: Option[];
  countries: Option[];
  limits: {
    categories: number;
    description_min: number;
    description_max: number;
    hashtags: number;
    hashtag_length: number;
    image_kb: number;
    image_min: Record<ImageSlot, [number, number]>;
  };
}

const LINKS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: "website", label: "Sitio web", placeholder: "https://miradio.com" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/miradio" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/miradio" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@miradio" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@miradio" },
  { key: "x", label: "X", placeholder: "https://x.com/miradio" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+51 999 888 777" },
];

export default function StationProfile({ profile, categoryGroups, languages, countries, limits }: Props) {
  const { studio } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const form = useForm(profile);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (window.location.hash === "#portada") {
      document.getElementById("portada")?.scrollIntoView({ block: "center" });
      return;
    }
    if (window.location.hash !== "#descripcion") return;
    descriptionRef.current?.scrollIntoView({ block: "center" });
    descriptionRef.current?.focus({ preventScroll: true });
  }, []);

  if (!studio) return null;
  const descriptionLength = form.data.description.trim().length;
  const describedEnough = descriptionLength >= limits.description_min;
  const station = studio.station;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/perfil"), { preserveScroll: true });
  };

  const upload = (slot: ImageSlot) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) router.post(url(`/perfil/imagenes/${slot}`), { image: file }, { forceFormData: true, preserveScroll: true });
  };
  const remove = (slot: ImageSlot) => () => router.delete(url(`/perfil/imagenes/${slot}`), { preserveScroll: true });
  const minSize = (slot: ImageSlot) => `${limits.image_min[slot][0]} × ${limits.image_min[slot][1]} px`;

  const preview = { name: station.name, frequency: station.frequency, logo_url: station.logo_url, accent_color: form.data.accent_color || null };
  const coverBackground = station.cover_url ? undefined : { background: stationArtwork(preview) };

  return (
    <StudioLayout title="Perfil de radio">
      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={submit} className="space-y-6 xl:col-span-2">
          <PageHeader eyebrow="Perfil" title="Perfil de radio" description="Lo que ven los oyentes en la página de tu radio y en el dial." />
          <PageErrors only={["image"]} />

          <Panel title="Imágenes" description={`JPG, PNG o WebP de hasta ${Math.round(limits.image_kb / 1024)} MB.`}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-3 rounded-xl border border-line p-4">
                <div className="flex aspect-square w-full max-w-40 items-center justify-center overflow-hidden rounded-[1.5rem] bg-raised">
                  {station.logo_url ? <img src={station.logo_url} alt="Logo de tu radio" className="size-full object-cover" /> : <ImagePlus className="size-6 text-faint" />}
                </div>
                <ImageSlotText
                  label="Logo"
                  hint={`El cuadrado de tu frecuencia: se ve en el dial, las listas y sobre tu foto de portada. Cuadrado, al menos ${minSize("logo")}.`}
                  hasImage={station.logo_url !== null}
                  onUpload={upload("logo")}
                  onRemove={remove("logo")}
                />
              </div>

              <div id="portada" className="scroll-mt-24 space-y-3 rounded-xl border border-line p-4 md:col-span-2">
                <div className="relative">
                  <div className="aspect-[3/1] w-full overflow-hidden rounded-xl bg-raised" style={coverBackground}>
                    {station.cover_url && <img src={station.cover_url} alt="Foto de portada de tu radio" className="size-full object-cover" />}
                  </div>
                  <StationLogo station={preview} size="md" className="absolute -bottom-5 left-4 z-10 shadow-lg ring-4 ring-surface" />
                </div>
                <div className="pt-4">
                  <ImageSlotText
                    label="Foto de portada"
                    hint={`La franja de arriba en la página de tu radio, detrás de tu logo. Horizontal, ideal 1600 × 530 px y al menos ${minSize("cover")}.`}
                    hasImage={station.cover_url !== null}
                    onUpload={upload("cover")}
                    onRemove={remove("cover")}
                  />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Presentación">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Eslogan" error={form.errors.tagline} className="sm:col-span-2">
                {(id, invalid) => <Input id={id} invalid={invalid} maxLength={140} value={form.data.tagline} onChange={(event) => form.setData("tagline", event.target.value)} placeholder="La radio del barrio" />}
              </Field>
              <div id="descripcion" className="scroll-mt-24 sm:col-span-2">
                <Field
                  label={
                    <span className="inline-flex items-center gap-2">
                      Descripción <Badge tone={describedEnough ? "neutral" : "warning"}>Obligatoria</Badge>
                    </span>
                  }
                  error={form.errors.description}
                  hint={
                    <span className="flex justify-between gap-3">
                      <span>Qué transmites, para quién y qué hace única a tu radio. Mínimo {limits.description_min} caracteres.</span>
                      <span className={cn("shrink-0 tabular", describedEnough ? "text-faint" : "text-warning")}>
                        {descriptionLength}/{limits.description_max}
                      </span>
                    </span>
                  }
                >
                  {(id, invalid) => (
                    <Textarea
                      ref={descriptionRef}
                      id={id}
                      invalid={invalid}
                      rows={5}
                      aria-required
                      maxLength={limits.description_max}
                      value={form.data.description}
                      onChange={(event) => form.setData("description", event.target.value)}
                      placeholder="Ej.: Radio Aurora acompaña a Lima con cumbia, salsa y noticias del barrio. Entrevistas a emprendedores locales cada mañana y la agenda cultural de la semana."
                    />
                  )}
                </Field>
              </div>
              <Field label="Idioma" error={form.errors.language}>
                {(id, invalid) => (
                  <Select id={id} invalid={invalid} value={form.data.language} onChange={(event) => form.setData("language", event.target.value)}>
                    {languages.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="País" error={form.errors.country}>
                {(id, invalid) => (
                  <Select id={id} invalid={invalid} value={form.data.country} onChange={(event) => form.setData("country", event.target.value)}>
                    <option value="">Sin país</option>
                    {countries.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Color de acento" error={form.errors.accent_color}>
                {(id, invalid) => (
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label="Elegir color" value={form.data.accent_color || "#e11d48"} onChange={(event) => form.setData("accent_color", event.target.value)} className="size-10 cursor-pointer rounded-lg border border-line-strong bg-surface" />
                    <Input id={id} invalid={invalid} value={form.data.accent_color} onChange={(event) => form.setData("accent_color", event.target.value)} placeholder="#e11d48" className="max-w-32" />
                  </div>
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Categorías" description={`Hasta ${limits.categories}. La primera es la principal.`}>
            <Field error={fieldError(form.errors, "categories")}>
              {() => <CategoryPicker groups={categoryGroups} value={form.data.categories} onChange={(value) => form.setData("categories", value)} max={limits.categories} />}
            </Field>
          </Panel>

          <Panel title="Hashtags permanentes" description="Ayudan a que te encuentren en la búsqueda.">
            <Field error={fieldError(form.errors, "hashtags")}>
              {(id, invalid) => <HashtagInput id={id} invalid={invalid} value={form.data.hashtags} onChange={(value) => form.setData("hashtags", value)} max={limits.hashtags} maxLength={limits.hashtag_length} />}
            </Field>
          </Panel>

          <Panel
            title="Redes y enlaces"
            footer={
              <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
                Guardar perfil
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {LINKS.map((link) => (
                <Field key={link.key} label={link.label} error={fieldError(form.errors, `links.${link.key}`)}>
                  {(id, invalid) => (
                    <Input id={id} invalid={invalid} value={form.data.links[link.key]} onChange={(event) => form.setData("links", { ...form.data.links, [link.key]: event.target.value })} placeholder={link.placeholder} />
                  )}
                </Field>
              ))}
            </div>
          </Panel>
        </form>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Panel title="Vista previa">
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="h-24 bg-raised bg-cover bg-center" style={station.cover_url ? { backgroundImage: `url(${station.cover_url})` } : coverBackground} />
              <div className="space-y-2 p-4">
                <div className="-mt-12 flex items-end gap-3">
                  <StationLogo station={preview} size="md" className="relative z-10 shadow-lg ring-4 ring-surface" />
                </div>
                <FrequencyTitle station={preview} size="md" />
                {form.data.tagline && <p className="text-sm text-muted">{form.data.tagline}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {form.data.categories.map((id) => {
                    const name = categoryGroups.flatMap((group) => group.categories).find((category) => category.id === id)?.name;
                    return name ? (
                      <span key={id} className="rounded-full bg-raised px-2.5 py-0.5 text-xs text-ink ring-1 ring-line">
                        {name}
                      </span>
                    ) : null;
                  })}
                </div>
                {form.data.hashtags.length > 0 && <p className="text-xs text-signal">{form.data.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </StudioLayout>
  );
}

function ImageSlotText({ label, hint, hasImage, onUpload, onRemove }: { label: string; hint: string; hasImage: boolean; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-muted">{hint}</p>
      <div className="flex items-center gap-3 pt-1">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-line-strong hover:ring-signal/50">
          <ImagePlus className="size-3.5" />
          {hasImage ? "Cambiar" : "Subir"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onUpload} />
        </label>
        {hasImage && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger">
            <Trash2 className="size-3" />
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
