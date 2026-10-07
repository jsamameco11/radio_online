import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { StatusNotice } from "@/Components/site/site-flash";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import AuthLayout from "@/Layouts/AuthLayout";

export default function ForgotPassword({ status }: { status: string | null }) {
  const form = useForm({ email: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/recuperar-clave");
  };

  return (
    <AuthLayout
      title="Recuperar contraseña"
      heading="¿Olvidaste tu contraseña?"
      description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva."
      footer={
        <Link href="/ingresar" className="font-medium text-ink underline-offset-4 hover:underline">
          Volver a ingresar
        </Link>
      }
    >
      <StatusNotice status={status} />
      <form onSubmit={submit} className="space-y-5">
        <Field label="Correo" error={form.errors.email}>
          {(id, invalid) => (
            <Input id={id} type="email" autoComplete="email" autoFocus invalid={invalid} value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} required />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={form.processing}>
          Enviar enlace
        </Button>
      </form>
    </AuthLayout>
  );
}
