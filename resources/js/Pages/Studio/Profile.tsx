import { router, useForm, usePage } from "@inertiajs/react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { CategoryPicker } from "@/Components/forms/category-picker";
import { fieldError } from "@/Components/forms/field-error";
import { HashtagInput } from "@/Components/forms/hashtag-input";
import { PageErrors } from "@/Components/forms/page-errors";
import { FrequencyTitle, StationLogo } from "@/Components/station/station-identity";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Textarea } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import type { SharedProps, Station } from "@/types";
import type { Option } from "@/types/admin";
import type { CategoryGroupOption, SocialLinks } from "@/types/station-admin";

/** StationResource also sends avatar_url and banner_url. */
type StationMedia = Station & { avatar_url?: string | null; banner_url?: string | null };

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
  limits: { categories: number; hashtags: number; hashtag_length: number; image_kb: number };
}

const SLOTS = [
  { slot: "logo", label: "Logo", hint: "Cuadrado, se ve en el dial y las listas." },
  { slot: "avatar", label: "Avatar", hint: "Para chats y menciones." },
  { slot: "cover", label: "Portada", hint: "Fondo de la página de tu radio." },
  { slot: "banner", label: "Banner", hint: "Franja horizontal para destacados." },
] as const;

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
  if (!studio) return null;
  const station: StationMedia = studio.station;
  const images: Record<string, string | null> = { logo: station.logo_url, avatar: station.avatar_url ?? null, cover: station.cover_url, banner: station.banner_url ?? null };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/perfil"), { preserveScroll: true });
  };

  const upload = (slot: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) router.post(url(`/perfil/imagenes/${slot}`), { image: file }, { forceFormData: true, preserveScroll: true });
  };

  const preview = { name: station.name, frequency: station.frequency, logo_url: station.logo_url, accent_color: form.data.accent_color || null };

  return (
    <StudioLayout title="Perfil de radio">
      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={submit} className="space-y-6 xl:col-span-2">
          <PageHeader eyebrow="Perfil" title="Perfil de radio" description="Lo que ven los oyentes en la página de tu radio y en el dial." />
          <PageErrors only={["image"]} />

          <Panel title="Imágenes" description={`JPG, PNG o WebP de hasta ${Math.round(limits.image_kb / 1024)} MB y al menos 128 × 128 px.`}>
            <div className="grid gap-4 sm:grid-cols-2">
              {SLOTS.map(({ slot, label, hint }) => (
                <div key={slot} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-raised">
                    {images[slot] ? <img src={images[slot] ?? undefined} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5 text-faint" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted">{hint}</p>
                    <div className="flex gap-2">
                      <label className="cursor-pointer text-xs font-medium text-signal hover:underline">
                        {images[slot] ? "Cambiar" : "Subir"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload(slot)} />
                      </label>
                      {images[slot] && (
                        <button type="button" onClick={() => router.delete(url(`/perfil/imagenes/${slot}`), { preserveScroll: true })} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger">
                          <Trash2 className="size-3" />
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Presentación">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Eslogan" error={form.errors.tagline} className="sm:col-span-2">
                {(id, invalid) => <Input id={id} invalid={invalid} maxLength={140} value={form.data.tagline} onChange={(event) => form.setData("tagline", event.target.value)} placeholder="La radio del barrio" />}
              </Field>
              <Field label="Descripción" error={form.errors.description} className="sm:col-span-2">
                {(id, invalid) => <Textarea id={id} invalid={invalid} rows={5} maxLength={2000} value={form.data.description} onChange={(event) => form.setData("description", event.target.value)} />}
              </Field>
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
              <div className="h-24 bg-raised bg-cover bg-center" style={station.cover_url ? { backgroundImage: `url(${station.cover_url})` } : { background: form.data.accent_color || undefined }} />
              <div className="space-y-2 p-4">
                <div className="-mt-12 flex items-end gap-3">
                  <StationLogo station={preview} size="md" className="ring-4 ring-surface" />
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
