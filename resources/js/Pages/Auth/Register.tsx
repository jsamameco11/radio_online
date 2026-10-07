import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { AuthDivider, GoogleSignInButton } from "@/Components/site/google-sign-in";
import { PasswordInput } from "@/Components/site/password-input";
import { Button, buttonClasses } from "@/Components/ui/button";
import { Checkbox, Field, Input } from "@/Components/ui/field";
import AuthLayout from "@/Layouts/AuthLayout";

export default function Register({ open }: { open: boolean }) {
  const form = useForm({ name: "", email: "", password: "", password_confirmation: "", terms: false });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/registro", { onFinish: () => form.reset("password", "password_confirmation") });
  };

  const footer = (
    <>
      ¿Ya tienes cuenta?{" "}
      <Link href="/ingresar" className="font-medium text-ink underline-offset-4 hover:underline">
        Ingresa
      </Link>
    </>
  );

  if (!open) {
    return (
      <AuthLayout title="Crear cuenta" heading="Registros pausados" description="Por ahora no estamos creando cuentas nuevas. Vuelve a intentarlo más adelante." footer={footer}>
        <Link href="/" className={buttonClasses("primary", "lg", "w-full")}>
          Seguir escuchando radios
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      heading="Crea tu cuenta"
      description="Es gratis. Con tu cuenta escuchas, te suscribes a tus radios, escribes en sus chats en vivo y puedes pedir tu propia frecuencia."
      footer={footer}
    >
      <GoogleSignInButton label="Registrarme con Google" />
      <p className="mt-2 text-center text-xs text-faint">Al continuar con Google aceptas los términos y condiciones y la política de privacidad.</p>
      <AuthDivider label="o crea tu cuenta con tu correo" />
      <form onSubmit={submit} className="space-y-5">
        <Field label="Nombre" error={form.errors.name}>
          {(id, invalid) => <Input id={id} autoComplete="name" autoFocus maxLength={80} invalid={invalid} value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} required />}
        </Field>
        <Field label="Correo" error={form.errors.email}>
          {(id, invalid) => <Input id={id} type="email" autoComplete="email" invalid={invalid} value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} required />}
        </Field>
        <Field label="Contraseña" error={form.errors.password} hint="Usa al menos 8 caracteres.">
          {(id, invalid) => (
            <PasswordInput id={id} autoComplete="new-password" invalid={invalid} value={form.data.password} onChange={(event) => form.setData("password", event.target.value)} required />
          )}
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
        <div className="space-y-1.5">
          <Checkbox
            label={<span className="text-muted">Acepto los términos y condiciones y la política de privacidad de Tu Radio Online.</span>}
            checked={form.data.terms}
            onChange={(event) => form.setData("terms", event.target.checked)}
            required
            className="items-start [&>input]:mt-0.5"
          />
          {form.errors.terms && (
            <p className="text-xs text-danger" role="alert">
              {form.errors.terms}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.processing} disabled={!form.data.terms}>
          Crear mi cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
