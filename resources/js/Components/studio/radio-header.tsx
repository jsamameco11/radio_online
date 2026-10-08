import { Link, usePage } from "@inertiajs/react";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { useAppUrl } from "@/lib/app-url";
import { cn } from "@/lib/cn";
import type { SharedProps, StationPermission } from "@/types";

interface Tab {
  path: string;
  label: string;
  permission: StationPermission | StationPermission[];
}

const TABS: Tab[] = [
  { path: "/consola", label: "Consola en vivo", permission: "console.operate" },
  { path: "/programacion", label: "Programación", permission: "schedule.manage" },
  { path: "/biblioteca", label: "Biblioteca", permission: "library.manage" },
  { path: "/listas", label: "Listas", permission: "library.manage" },
  { path: "/catalogo", label: "Catálogo musical", permission: "library.manage" },
  { path: "/episodios", label: "Episodios", permission: "episodes.manage" },
  { path: "/editor", label: "Editor de audio", permission: ["library.manage", "episodes.manage"] },
  { path: "/configuracion", label: "Configuración", permission: "station.settings" },
];

const SETTINGS: { path: string; label: string }[] = [
  { path: "/configuracion", label: "General" },
  { path: "/configuracion/frecuencia", label: "Frecuencia" },
  { path: "/configuracion/transmision", label: "Transmisión" },
  { path: "/configuracion/audio", label: "Audio" },
  { path: "/configuracion/automatizacion", label: "Automatización" },
  { path: "/configuracion/mensajes", label: "Mensajes" },
  { path: "/configuracion/regalos", label: "Regalos" },
  { path: "/configuracion/moderacion", label: "Moderación" },
  { path: "/configuracion/equipo", label: "Equipo" },
  { path: "/configuracion/notificaciones", label: "Notificaciones" },
  { path: "/configuracion/privacidad", label: "Privacidad" },
  { path: "/configuracion/seguridad", label: "Seguridad" },
];

function usePath(): string {
  return usePage().url.split("?")[0].replace(/\/+$/, "");
}

/** Header of every radio section of the studio: title, quick link to the station and the section tabs. */
export function RadioHeader({ title, description, actions, compact = false }: { title: string; description?: ReactNode; actions?: ReactNode; compact?: boolean }) {
  const { studio } = usePage<SharedProps>().props;
  const appUrl = useAppUrl();
  const url = useStudioUrl();
  const can = useStudioCan();
  const path = usePath();

  if (!studio) return null;
  const station = studio.station;
  const tabs = TABS.filter((tab) => [tab.permission].flat().some(can));
  const inSettings = path.startsWith(url("/configuracion"));

  return (
    <div className={cn("min-w-0", compact ? "space-y-3" : "space-y-5")}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl space-y-1.5">
          <p className="truncate text-[11px] font-semibold tracking-[0.22em] text-signal uppercase">
            <span className="tabular">{station.frequency.label}</span> {station.name} · Estudio
          </p>
          <h1 className={cn("font-display font-semibold tracking-tight break-words text-ink", compact ? "text-2xl" : "text-2xl sm:text-3xl")}>{title}</h1>
          {description && !compact && <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <a
            href={appUrl("public", `/radio/${station.frequency.slug}`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal"
          >
            Escuchar la radio <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <nav aria-label="Secciones de la radio" className="flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 [scrollbar-width:none]">
        {tabs.map((tab) => {
          const href = url(tab.path);
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <Link
              key={tab.path}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition",
                active ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:bg-raised hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {inSettings && can("station.settings") && (
        <nav aria-label="Secciones de configuración" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {SETTINGS.map((item) => {
            const href = url(item.path);
            const active = path === href;
            return (
              <Link
                key={item.path}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
                  active ? "bg-signal-soft text-signal" : "text-muted hover:bg-raised hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
