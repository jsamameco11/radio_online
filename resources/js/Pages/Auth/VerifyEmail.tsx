import { router, useForm, usePage } from "@inertiajs/react";
import { MailCheck } from "lucide-react";
import { StatusNotice } from "@/Components/site/site-flash";
import { Button } from "@/Components/ui/button";
import AuthLayout from "@/Layouts/AuthLayout";
import type { SharedProps } from "@/types";

export default function VerifyEmail({ status }: { status: string | null }) {
  const { auth } = usePage<SharedProps>().props;
  const form = useForm({});

  return (
    <AuthLayout
      title="Verifica tu correo"
      heading="Revisa tu bandeja de entrada"
      description={
        <>
          Te enviamos un enlace a <span className="font-medium text-ink">{auth.user?.email}</span>. Ábrelo para activar tu cuenta.
        </>
      }
      footer={
        <button type="button" onClick={() => router.post("/salir")} className="font-medium text-ink underline-offset-4 hover:underline">
          Usar otra cuenta
        </button>
      }
    >
      <StatusNotice status={status} />
      <div className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-signal-soft text-signal">
          <MailCheck className="size-5" />
        </span>
        <div className="space-y-3 text-sm text-muted">
          <p>¿No te llegó? Revisa la carpeta de spam o pide un enlace nuevo.</p>
          <Button variant="secondary" loading={form.processing} onClick={() => form.post("/verificar-correo/reenviar")}>
            Reenviar enlace
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
