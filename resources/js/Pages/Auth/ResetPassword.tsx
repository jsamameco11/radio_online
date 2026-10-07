import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { PasswordInput } from "@/Components/site/password-input";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import AuthLayout from "@/Layouts/AuthLayout";

export default function ResetPassword({ email, token }: { email: string; token: string }) {
  const form = useForm({ token, email, password: "", password_confirmation: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/restablecer-clave", { onFinish: () => form.reset("password", "password_confirmation") });
  };

  return (
    <AuthLayout title="Nueva contraseña" heading="Crea una contraseña nueva" description="Después podrás ingresar con ella en todos tus dispositivos.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Correo" error={form.errors.email}>
          {(id, invalid) => <Input id={id} type="email" autoComplete="username" invalid={invalid} value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} required />}
        </Field>
        <Field label="Contraseña nueva" error={form.errors.password} hint="Usa al menos 8 caracteres.">
          {(id, invalid) => (
            <PasswordInput id={id} autoComplete="new-password" autoFocus invalid={invalid} value={form.data.password} onChange={(event) => form.setData("password", event.target.value)} required />
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
        <Button type="submit" size="lg" className="w-full" loading={form.processing}>
          Guardar contraseña
        </Button>
      </form>
    </AuthLayout>
  );
}
