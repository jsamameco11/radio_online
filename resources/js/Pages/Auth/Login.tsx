import { Link, useForm, usePage } from "@inertiajs/react";
import type { FormEvent } from "react";
import { GoogleSignInButton } from "@/Components/site/google-sign-in";
import { PasswordInput } from "@/Components/site/password-input";
import { StatusNotice } from "@/Components/site/site-flash";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input } from "@/Components/ui/field";
import AuthLayout from "@/Layouts/AuthLayout";
import type { SharedProps } from "@/types";

/** Listeners (public host) and creators (console host) sign in with Google; the platform staff, with a username on the control host. */
export default function Login({ status }: { status: string | null }) {
  const { app } = usePage<SharedProps>().props;

  if (app.host === "control") {
    return <StaffSignIn status={status} />;
  }

  const listener = app.host === "public";

  return (
    <AuthLayout
      title="Ingresar"
      heading={listener ? "Ingresa a tu cuenta" : "Entra a tu consola"}
      description={
        listener ? "Con tu cuenta de Google puedes enviar regalos, seguir tus canales y escribir en el chat." : "Los creadores ingresan con la cuenta de Google con la que crearon su canal."
      }
      footer={
        listener && (
          <>
            Para escuchar no necesitas cuenta.{" "}
            <Link href="/" className="font-medium text-ink underline-offset-4 hover:underline">
              Seguir escuchando
            </Link>
          </>
        )
      }
    >
      <StatusNotice status={status} />
      <GoogleSignInButton />
      <p className="mt-4 text-center text-xs text-muted">Si es tu primera vez, tu cuenta se crea al continuar.</p>
    </AuthLayout>
  );
}

function StaffSignIn({ status }: { status: string | null }) {
  const form = useForm({ username: "", password: "", remember: false });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/ingresar", { onFinish: () => form.reset("password") });
  };

  return (
    <AuthLayout title="Ingresar" heading="Panel de administración" description="Ingresa con tu usuario y contraseña del personal de la plataforma.">
      <StatusNotice status={status} />
      <form onSubmit={submit} className="space-y-5">
        <Field label="Usuario" error={form.errors.username}>
          {(id, invalid) => (
            <Input
              id={id}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              invalid={invalid}
              value={form.data.username}
              onChange={(event) => form.setData("username", event.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Contraseña" error={form.errors.password}>
          {(id, invalid) => (
            <PasswordInput id={id} autoComplete="current-password" invalid={invalid} value={form.data.password} onChange={(event) => form.setData("password", event.target.value)} required />
          )}
        </Field>
        <Checkbox label="Mantener la sesión iniciada" checked={form.data.remember} onChange={(event) => form.setData("remember", event.target.checked)} />
        <Button type="submit" size="lg" className="w-full" loading={form.processing}>
          Ingresar
        </Button>
      </form>
    </AuthLayout>
  );
}
