import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { PasswordInput } from "@/Components/site/password-input";
import { Button } from "@/Components/ui/button";
import { Field } from "@/Components/ui/field";
import AuthLayout from "@/Layouts/AuthLayout";

export default function ConfirmPassword() {
  const form = useForm({ password: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/cuenta/confirmar-clave", { onFinish: () => form.reset() });
  };

  return (
    <AuthLayout title="Confirmar contraseña" heading="Confirma tu contraseña" description="Es una zona protegida de tu cuenta. Escribe tu contraseña para continuar.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Contraseña" error={form.errors.password}>
          {(id, invalid) => (
            <PasswordInput id={id} autoComplete="current-password" autoFocus invalid={invalid} value={form.data.password} onChange={(event) => form.setData("password", event.target.value)} required />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={form.processing}>
          Confirmar
        </Button>
      </form>
    </AuthLayout>
  );
}
