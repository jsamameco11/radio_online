import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import AuthLayout from "@/Layouts/AuthLayout";

export default function TwoFactorChallenge() {
  const [recovery, setRecovery] = useState(false);
  const form = useForm({ code: "", recovery_code: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.transform((data) => (recovery ? { recovery_code: data.recovery_code } : { code: data.code }));
    form.post("/verificacion-en-dos-pasos", { onFinish: () => form.reset() });
  };

  const switchMode = () => {
    setRecovery(!recovery);
    form.reset();
    form.clearErrors();
  };

  return (
    <AuthLayout
      title="Verificación en dos pasos"
      heading="Confirma que eres tú"
      description={
        recovery
          ? "Escribe uno de los códigos de recuperación que guardaste al activar la verificación en dos pasos."
          : "Abre tu app de autenticación y escribe el código de 6 dígitos."
      }
      footer={
        <button type="button" onClick={switchMode} className="font-medium text-ink underline-offset-4 hover:underline">
          {recovery ? "Usar el código de mi app" : "Usar un código de recuperación"}
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {recovery ? (
          <Field label="Código de recuperación" error={form.errors.recovery_code}>
            {(id, invalid) => (
              <Input
                id={id}
                autoComplete="one-time-code"
                autoFocus
                invalid={invalid}
                value={form.data.recovery_code}
                onChange={(event) => form.setData("recovery_code", event.target.value.trim())}
                className="font-mono"
                required
              />
            )}
          </Field>
        ) : (
          <Field label="Código" error={form.errors.code}>
            {(id, invalid) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                invalid={invalid}
                value={form.data.code}
                onChange={(event) => form.setData("code", event.target.value.replace(/\D/g, ""))}
                className="h-12 text-center font-display text-2xl tracking-[0.5em] tabular"
                required
              />
            )}
          </Field>
        )}
        <Button type="submit" size="lg" className="w-full" loading={form.processing}>
          Verificar
        </Button>
      </form>
    </AuthLayout>
  );
}
