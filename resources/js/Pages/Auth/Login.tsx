import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { AuthDivider, GoogleSignInButton } from "@/Components/site/google-sign-in";
import { PasswordInput } from "@/Components/site/password-input";
import { StatusNotice } from "@/Components/site/site-flash";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input } from "@/Components/ui/field";
import AuthLayout from "@/Layouts/AuthLayout";

export default function Login({ canRegister, status }: { canRegister: boolean; status: string | null }) {
  const form = useForm({ email: "", password: "", remember: false });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/ingresar", { onFinish: () => form.reset("password") });
  };

  return (
    <AuthLayout
      title="Ingresar"
      heading="Bienvenido de vuelta"
      description={canRegister ? "Ingresa para escuchar tus radios favoritas." : "Ingresa a tu estudio o al panel de la plataforma."}
      footer={
        canRegister && (
          <>
            ¿Aún no tienes cuenta?{" "}
            <Link href="/registro" className="font-medium text-ink underline-offset-4 hover:underline">
              Crea una gratis
            </Link>
          </>
        )
      }
    >
      <StatusNotice status={status} />
      <GoogleSignInButton />
      <AuthDivider label="o ingresa con tu correo" />
      <form onSubmit={submit} className="space-y-5">
        <Field label="Correo" error={form.errors.email}>
          {(id, invalid) => (
            <Input id={id} type="email" autoComplete="username" autoFocus invalid={invalid} value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} required />
          )}
        </Field>
        <Field
          label={
            <span className="flex items-center justify-between">
              Contraseña
              <Link href="/recuperar-clave" className="text-xs font-normal text-muted hover:text-ink">
                ¿La olvidaste?
              </Link>
            </span>
          }
          error={form.errors.password}
        >
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
