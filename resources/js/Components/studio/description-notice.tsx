import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { ButtonLink } from "@/Components/ui/button";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";

export interface MissingDescription {
  /** Something is written, just too short. */
  started: boolean;
  min: number;
}

/** The station description is required: until it is written, the studio asks for it first. */
export function DescriptionNotice({ missing }: { missing: MissingDescription }) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const canEdit = can("station.profile");

  return (
    <section aria-labelledby="description-notice-title" className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-warning ring-1 ring-warning/20">
        <FileText className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="description-notice-title" className="font-display text-base font-semibold text-ink">
            {missing.started ? "La descripción de tu canal es muy corta" : "A tu canal le falta la descripción"}
          </h2>
          <Badge tone="warning">Obligatoria</Badge>
        </div>
        <p className="text-sm text-muted">
          Es lo primero que lee la audiencia en la página de tu canal y nos ayuda a mostrarlo en la búsqueda y en las recomendaciones. Escribe al menos {missing.min} caracteres: qué transmites, para quién y qué lo hace único.
          {!canEdit && " Pídele al propietario o a un administrador del canal que la complete."}
        </p>
      </div>
      {canEdit && (
        <ButtonLink href={url("/perfil#descripcion")} className="self-start sm:self-center">
          {missing.started ? "Completar descripción" : "Escribir descripción"}
          <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      )}
    </section>
  );
}
