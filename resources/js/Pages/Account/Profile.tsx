import { router, useForm } from "@inertiajs/react";
import { Camera, MailWarning, Trash2 } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useRef } from "react";
import { AccountShell } from "@/Components/account/account-shell";
import { Avatar } from "@/Components/ui/avatar";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { dateTime } from "@/lib/format";

interface Profile {
  name: string;
  email: string;
  country: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  member_since: string;
}

const countryCodes = [
  "AR", "BO", "BR", "CA", "CL", "CO", "CR", "CU", "DE", "DO", "EC", "ES", "FR", "GB", "GQ",
  "GT", "HN", "IT", "MX", "NI", "PA", "PE", "PR", "PT", "PY", "SV", "US", "UY", "VE",
];

function countryOptions(current: string | null): { code: string; name: string }[] {
  const names = new Intl.DisplayNames(["es"], { type: "region" });
  const codes = current && !countryCodes.includes(current) ? [...countryCodes, current] : countryCodes;
  return codes.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function AvatarPanel({ profile }: { profile: Profile }) {
  const input = useRef<HTMLInputElement>(null);
  const form = useForm<{ avatar: File | null }>({ avatar: null });

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    form.transform(() => ({ avatar: file }));
    form.post("/cuenta/perfil/foto", { forceFormData: true, preserveScroll: true });
  };

  const remove = () => router.delete("/cuenta/perfil/foto", { preserveScroll: true });

  return (
    <Panel title="Foto de perfil" description="Se muestra en tus mensajes, regalos y en tu equipo de radio.">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={profile.name} src={profile.avatar_url} size="lg" className="size-20 text-xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
            <Button variant="secondary" icon={<Camera className="size-4" />} loading={form.processing} onClick={() => input.current?.click()}>
              {profile.avatar_url ? "Cambiar foto" : "Subir foto"}
            </Button>
            {profile.avatar_url && (
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={remove}>
                Quitar
              </Button>
            )}
          </div>
          {form.errors.avatar ? (
            <p className="text-xs text-danger" role="alert">
              {form.errors.avatar}
            </p>
          ) : (
            <p className="text-xs text-muted">JPG, PNG o WebP de hasta 2 MB.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function Profile({ profile, resendVerificationUrl }: { profile: Profile; resendVerificationUrl: string }) {
  const form = useForm({ name: profile.name, email: profile.email, country: profile.country ?? "" });
  const resend = useForm({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.patch("/cuenta/perfil", { preserveScroll: true });
  };

  return (
    <AccountShell title="Perfil" description={`Miembro desde ${dateTime(profile.member_since, { dateStyle: "long" })}.`}>
      <AvatarPanel profile={profile} />

      {!profile.email_verified && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warning bg-warning-soft px-5 py-4">
          <p className="flex items-start gap-3 text-sm text-ink">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-warning" />
            Aún no verificas {profile.email}. Revisa tu bandeja de entrada para confirmarlo.
          </p>
          <Button variant="secondary" size="sm" loading={resend.processing} onClick={() => resend.post(resendVerificationUrl, { preserveScroll: true })}>
            Reenviar enlace
          </Button>
        </div>
      )}

      <form onSubmit={submit}>
        <Panel
          title="Datos personales"
          description="Si cambias tu correo tendrás que verificarlo de nuevo."
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nombre" error={form.errors.name}>
              {(id, invalid) => <Input id={id} autoComplete="name" maxLength={80} invalid={invalid} value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} required />}
            </Field>
            <Field label="Correo" error={form.errors.email}>
              {(id, invalid) => <Input id={id} type="email" autoComplete="email" invalid={invalid} value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} required />}
            </Field>
            <Field label="País" error={form.errors.country} hint="Nos ayuda a recomendarte radios cercanas.">
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={form.data.country} onChange={(event) => form.setData("country", event.target.value)}>
                  <option value="">Sin especificar</option>
                  {countryOptions(profile.country).map(({ code, name }) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Panel>
      </form>
    </AccountShell>
  );
}
