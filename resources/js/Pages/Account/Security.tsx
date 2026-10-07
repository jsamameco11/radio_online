import { router, useForm, usePage } from "@inertiajs/react";
import { Check, Copy, KeyRound, Laptop, LogOut, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { AccountShell } from "@/Components/account/account-shell";
import { GoogleMark } from "@/Components/site/google-sign-in";
import { PasswordInput } from "@/Components/site/password-input";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { Panel } from "@/Components/ui/panel";
import { ago, dateTime } from "@/lib/format";
import { HttpError, http } from "@/lib/http";
import type { SharedProps } from "@/types";

interface TwoFactorState {
  enabled: boolean;
  pending: boolean;
  confirmed_at: string | null;
  qr_svg: string | null;
  secret: string | null;
  recovery_codes: string[] | null;
}

interface AccountSession {
  id: string;
  browser: string;
  platform: string;
  mobile: boolean;
  ip_address: string | null;
  last_active_at: string;
  current: boolean;
}

interface Endpoints {
  password: string;
  two_factor: string;
  two_factor_confirm: string;
  recovery_codes: string;
  confirm_password: string;
  password_status: string;
  set_password: string;
}

interface SignInMethods {
  has_password: boolean;
  google_linked: boolean;
}

interface SecurityProps {
  twoFactor: TwoFactorState;
  staffNeedsTwoFactor: boolean;
  signIn: SignInMethods;
  sessions: AccountSession[];
  endpoints: Endpoints;
}

/** Fortify guards two-factor changes behind a recent password confirmation; this asks for it in place. */
function usePasswordConfirmation(endpoints: Endpoints) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPending(null);
    setPassword("");
    setError(null);
  };

  const confirmThen = async (action: () => void) => {
    const { confirmed } = await http.get<{ confirmed: boolean }>(endpoints.password_status);
    if (confirmed) action();
    else setPending(() => action);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await http.post(endpoints.confirm_password, { password });
      const action = pending;
      close();
      action?.();
    } catch (exception) {
      setError(exception instanceof HttpError ? exception.firstError() : "No pudimos confirmar tu contraseña. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <Modal
      open={pending !== null}
      onClose={close}
      size="sm"
      title="Confirma tu contraseña"
      description="Por seguridad, escríbela antes de cambiar la verificación en dos pasos."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Contraseña" error={error ?? undefined}>
          {(id, invalid) => <PasswordInput id={id} autoComplete="current-password" autoFocus invalid={invalid} value={password} onChange={(event) => setPassword(event.target.value)} required />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" loading={busy}>
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  );

  return { confirmThen, modal };
}

function PasswordPanel({ endpoint }: { endpoint: string }) {
  const form = useForm({ current_password: "", password: "", password_confirmation: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(endpoint, {
      errorBag: "updatePassword",
      preserveScroll: true,
      onSuccess: () => form.reset(),
      onError: () => form.reset("password", "password_confirmation"),
    });
  };

  return (
    <form onSubmit={submit}>
      <Panel
        title="Contraseña"
        description="Usa una contraseña larga que no uses en otros sitios."
        footer={
          <Button type="submit" loading={form.processing}>
            Cambiar contraseña
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Contraseña actual" error={form.errors.current_password}>
            {(id, invalid) => (
              <PasswordInput id={id} autoComplete="current-password" invalid={invalid} value={form.data.current_password} onChange={(event) => form.setData("current_password", event.target.value)} required />
            )}
          </Field>
          <Field label="Contraseña nueva" error={form.errors.password}>
            {(id, invalid) => <PasswordInput id={id} autoComplete="new-password" invalid={invalid} value={form.data.password} onChange={(event) => form.setData("password", event.target.value)} required />}
          </Field>
          <Field label="Repite la nueva" error={form.errors.password_confirmation}>
            {(id, invalid) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                invalid={invalid}
                value={form.data.password_confirmation}
                onChange={(event) => form.setData("password_confirmation", event.target.value)}
                required
              />
            )}
          </Field>
        </div>
      </Panel>
    </form>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Códigos de recuperación</p>
        <Button variant="ghost" size="sm" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={copy}>
          {copied ? "Copiados" : "Copiar"}
        </Button>
      </div>
      <p className="text-xs text-muted">Guárdalos en un lugar seguro. Cada uno sirve una sola vez si pierdes tu teléfono.</p>
      <ul className="grid gap-2 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code} className="rounded-lg bg-surface px-3 py-1.5 text-center">
            {code}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TwoFactorPanel({ twoFactor, endpoints, hasPassword }: { twoFactor: TwoFactorState; endpoints: Endpoints; hasPassword: boolean }) {
  const staff = usePage<SharedProps>().props.auth.user?.is_staff ?? false;
  const { confirmThen, modal } = usePasswordConfirmation(endpoints);
  const [working, setWorking] = useState(false);
  const confirmForm = useForm({ code: "" });

  const visit = (action: () => void) => {
    setWorking(true);
    confirmThen(action).finally(() => setWorking(false));
  };

  const options = { preserveScroll: true };
  const enable = () => visit(() => router.post(endpoints.two_factor, {}, options));
  const disable = () => visit(() => router.delete(endpoints.two_factor, options));
  const regenerate = () => visit(() => router.post(endpoints.recovery_codes, {}, options));
  const showCodes = () => visit(() => router.get("/cuenta/seguridad/codigos", {}, options));

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    confirmForm.post(endpoints.two_factor_confirm, { errorBag: "confirmTwoFactorAuthentication", preserveScroll: true, onSuccess: () => confirmForm.reset() });
  };

  return (
    <Panel
      title="Verificación en dos pasos"
      description="Además de tu contraseña, te pediremos un código de tu app de autenticación (Google Authenticator, 1Password, Authy…)."
      actions={twoFactor.enabled ? <Badge tone="onair">Activa</Badge> : twoFactor.pending ? <Badge tone="warning">Pendiente</Badge> : <Badge>Desactivada</Badge>}
    >
      {modal}

      {twoFactor.enabled && (
        <div className="space-y-5">
          <p className="flex items-center gap-2 text-sm text-muted">
            <ShieldCheck className="size-5 text-onair" />
            Activa desde {twoFactor.confirmed_at ? dateTime(twoFactor.confirmed_at, { dateStyle: "long" }) : "hace un tiempo"}.
          </p>
          {twoFactor.recovery_codes && <RecoveryCodes codes={twoFactor.recovery_codes} />}
          <div className="flex flex-wrap gap-2">
            {!twoFactor.recovery_codes && (
              <Button variant="secondary" icon={<KeyRound className="size-4" />} onClick={showCodes} disabled={working}>
                Ver códigos de recuperación
              </Button>
            )}
            <Button variant="secondary" onClick={regenerate} disabled={working}>
              Generar códigos nuevos
            </Button>
            <Button variant="ghost" className="text-danger" onClick={disable} disabled={working}>
              Desactivar
            </Button>
          </div>
          {staff && <p className="text-xs text-muted">Si la desactivas perderás el acceso al panel de administración hasta que la vuelvas a activar.</p>}
        </div>
      )}

      {twoFactor.pending && (
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          {twoFactor.qr_svg && (
            <div className="w-fit rounded-2xl border border-line bg-white p-3 [&_svg]:size-44" dangerouslySetInnerHTML={{ __html: twoFactor.qr_svg }} aria-label="Código QR para tu app de autenticación" />
          )}
          <form onSubmit={confirm} className="space-y-4">
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
              <li>Escanea el código QR con tu app de autenticación.</li>
              <li>Escribe el código de 6 dígitos que te muestra.</li>
            </ol>
            {twoFactor.secret && (
              <p className="text-xs text-muted">
                ¿No puedes escanear? Escribe esta clave: <span className="font-mono text-ink select-all">{twoFactor.secret}</span>
              </p>
            )}
            <Field label="Código" error={confirmForm.errors.code}>
              {(id, invalid) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  invalid={invalid}
                  value={confirmForm.data.code}
                  onChange={(event) => confirmForm.setData("code", event.target.value.replace(/\D/g, ""))}
                  className="max-w-48 text-center font-display text-lg tracking-[0.4em] tabular"
                  required
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={confirmForm.processing}>
                Confirmar y activar
              </Button>
              <Button variant="ghost" onClick={disable} disabled={working}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {!twoFactor.enabled && !twoFactor.pending && (
        <div className="space-y-2">
          <Button icon={<ShieldCheck className="size-4" />} onClick={enable} loading={working} disabled={!hasPassword}>
            Activar verificación en dos pasos
          </Button>
          {!hasPassword && <p className="text-xs text-muted">Primero crea una contraseña: la pediremos para confirmar este cambio.</p>}
        </div>
      )}
    </Panel>
  );
}

function SessionsPanel({ sessions, hasPassword }: { sessions: AccountSession[]; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const form = useForm({ password: "" });
  const others = sessions.some((session) => !session.current);

  const close = () => {
    setOpen(false);
    form.reset();
    form.clearErrors();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.delete("/cuenta/sesiones", { preserveScroll: true, onSuccess: close });
  };

  return (
    <Panel
      title="Sesiones abiertas"
      description="Navegadores donde tu cuenta está iniciada."
      padded={false}
      actions={
        others && (
          <Button
            variant="secondary"
            size="sm"
            icon={<LogOut className="size-4" />}
            onClick={() => setOpen(true)}
            disabled={!hasPassword}
            title={hasPassword ? undefined : "Primero crea una contraseña"}
          >
            Cerrar las demás
          </Button>
        )
      }
    >
      <ul className="divide-y divide-line">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center gap-4 px-5 py-3.5">
            <span className="grid size-10 place-items-center rounded-xl bg-raised text-muted">{session.mobile ? <Smartphone className="size-5" /> : <Laptop className="size-5" />}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {session.browser} en {session.platform}
              </p>
              <p className="text-xs text-muted">
                {session.ip_address ?? "IP desconocida"} · {session.current ? "este dispositivo" : `activa ${ago(session.last_active_at)}`}
              </p>
            </div>
            {session.current && <Badge tone="onair">Actual</Badge>}
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={close} size="sm" title="Cerrar las demás sesiones" description="Tu cuenta seguirá abierta solo en este dispositivo.">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Contraseña" error={form.errors.password}>
            {(id, invalid) => <PasswordInput id={id} autoComplete="current-password" autoFocus invalid={invalid} value={form.data.password} onChange={(event) => form.setData("password", event.target.value)} required />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={form.processing}>
              Cerrar sesiones
            </Button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

function SetPasswordPanel({ endpoint }: { endpoint: string }) {
  const form = useForm({ password: "", password_confirmation: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(endpoint, { preserveScroll: true, onFinish: () => form.reset() });
  };

  return (
    <form onSubmit={submit}>
      <Panel
        title="Crea una contraseña"
        description="Tu cuenta se creó con Google. Con una contraseña también podrás ingresar con tu correo, activar la verificación en dos pasos y cerrar otras sesiones."
        footer={
          <Button type="submit" loading={form.processing}>
            Crear contraseña
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contraseña" error={form.errors.password} hint="Usa al menos 8 caracteres.">
            {(id, invalid) => <PasswordInput id={id} autoComplete="new-password" invalid={invalid} value={form.data.password} onChange={(event) => form.setData("password", event.target.value)} required />}
          </Field>
          <Field label="Repite la contraseña" error={form.errors.password_confirmation}>
            {(id, invalid) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                invalid={invalid}
                value={form.data.password_confirmation}
                onChange={(event) => form.setData("password_confirmation", event.target.value)}
                required
              />
            )}
          </Field>
        </div>
      </Panel>
    </form>
  );
}

function SignInMethodsPanel({ signIn }: { signIn: SignInMethods }) {
  return (
    <Panel title="Formas de ingresar" padded={false}>
      <ul className="divide-y divide-line">
        <li className="flex items-center gap-4 px-5 py-3.5">
          <span className="grid size-10 place-items-center rounded-xl bg-raised">
            <GoogleMark />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{signIn.google_linked ? "Cuenta vinculada con Google" : "Google"}</p>
            <p className="text-xs text-muted">
              {signIn.google_linked
                ? "Puedes ingresar con «Continuar con Google» en cualquier dispositivo."
                : "Si tu correo es de Google, usa «Continuar con Google» al ingresar y tu cuenta se vinculará."}
            </p>
          </div>
          {signIn.google_linked ? <Badge tone="onair">Vinculada</Badge> : <Badge>No vinculada</Badge>}
        </li>
        <li className="flex items-center gap-4 px-5 py-3.5">
          <span className="grid size-10 place-items-center rounded-xl bg-raised text-muted">
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Correo y contraseña</p>
            <p className="text-xs text-muted">{signIn.has_password ? "Ingresas con tu correo y tu contraseña." : "Aún no tienes contraseña: créala abajo."}</p>
          </div>
          {signIn.has_password ? <Badge tone="onair">Activa</Badge> : <Badge tone="warning">Sin contraseña</Badge>}
        </li>
      </ul>
    </Panel>
  );
}

export default function Security({ twoFactor, staffNeedsTwoFactor, signIn, sessions, endpoints }: SecurityProps) {
  return (
    <AccountShell title="Seguridad" description="Contraseña, verificación en dos pasos y dispositivos conectados.">
      {staffNeedsTwoFactor && (
        <div role="alert" className="flex items-start gap-4 rounded-2xl border border-danger bg-danger-soft px-5 py-4">
          <ShieldAlert className="mt-0.5 size-6 shrink-0 text-danger" />
          <div className="space-y-1">
            <p className="font-semibold text-ink">Activa la verificación en dos pasos para entrar al panel de administración</p>
            <p className="text-sm text-muted">Tu cuenta tiene permisos de la plataforma. Actívala abajo y vuelve a intentarlo.</p>
          </div>
        </div>
      )}
      <SignInMethodsPanel signIn={signIn} />
      {!signIn.has_password && <SetPasswordPanel endpoint={endpoints.set_password} />}
      <TwoFactorPanel twoFactor={twoFactor} endpoints={endpoints} hasPassword={signIn.has_password} />
      {signIn.has_password && <PasswordPanel endpoint={endpoints.password} />}
      <SessionsPanel sessions={sessions} hasPassword={signIn.has_password} />
    </AccountShell>
  );
}
