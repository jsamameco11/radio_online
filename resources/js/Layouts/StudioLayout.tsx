import { Head, Link, usePage } from "@inertiajs/react";
import {
  AudioLines,
  BadgeDollarSign,
  BarChart3,
  CalendarClock,
  Disc3,
  ExternalLink,
  Gift,
  Hash,
  LayoutDashboard,
  Library,
  ListMusic,
  Mail,
  MessagesSquare,
  Mic2,
  Podcast,
  Radio,
  Scissors,
  Settings2,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NavGroup, NavItem } from "@/Components/shell/sidebar-shell";
import { SidebarShell } from "@/Components/shell/sidebar-shell";
import { UserMenu } from "@/Components/shell/user-menu";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { LiveChatDock } from "@/Components/studio/chat/live-chat-dock";
import type { SharedProps, StationPermission } from "@/types";

/** Base URL of the open studio: "/estudio/89-30". */
export function useStudioUrl(): (path?: string) => string {
  const { studio } = usePage<SharedProps>().props;
  return (path = "") => `/estudio/${studio?.station.frequency.slug}${path}`;
}

export function useStudioCan(): (permission: StationPermission) => boolean {
  const { studio } = usePage<SharedProps>().props;
  return (permission) => Boolean(studio?.permissions.includes(permission));
}

/** Shown when the member holds any of the permissions. */
type Item = NavItem & { permission?: StationPermission | StationPermission[] };

/** Studio of one station: dark, tool-like, with every section in the aside. */
export default function StudioLayout({ title, children }: { title: string; children: ReactNode }) {
  const { studio, app } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const can = useStudioCan();

  if (!studio) return null;
  const station = studio.station;

  const groups: { label?: string; items: Item[] }[] = [
    {
      items: [
        { label: "Resumen", href: url(), icon: LayoutDashboard, prefix: false },
        { label: "Metas y crecimiento", href: url("/crecimiento"), icon: Trophy, permission: "analytics.view" },
        { label: "Consola en vivo", href: url("/consola"), icon: Radio, permission: "console.operate" },
        { label: "Chat en vivo", href: url("/chat"), icon: MessagesSquare, permission: "console.operate" },
        { label: "Programación", href: url("/programacion"), icon: CalendarClock, permission: "schedule.manage" },
      ],
    },
    {
      label: "Contenido",
      items: [
        { label: "Biblioteca", href: url("/biblioteca"), icon: Library, permission: "library.manage" },
        { label: "Grabaciones", href: url("/grabaciones"), icon: Mic2, permission: "library.manage" },
        { label: "Listas", href: url("/listas"), icon: ListMusic, permission: "library.manage" },
        { label: "Catálogo musical", href: url("/catalogo"), icon: Disc3, permission: "library.manage" },
        { label: "Episodios", href: url("/episodios"), icon: Podcast, permission: "episodes.manage" },
        { label: "Editor de audio", href: url("/editor"), icon: Scissors, permission: ["library.manage", "episodes.manage"] },
      ],
    },
    {
      label: "Audiencia",
      items: [
        { label: "Tema y hashtags", href: url("/tema"), icon: Hash, permission: "console.operate" },
        { label: "Regalos", href: url("/regalos"), icon: Gift, permission: "gifts.view" },
        { label: "Mensajes", href: url("/mensajes"), icon: Mail, permission: "gifts.view" },
        { label: "Estadísticas", href: url("/estadisticas"), icon: BarChart3, permission: "analytics.view" },
        { label: "Audiencia", href: url("/audiencia"), icon: Users, permission: "analytics.view" },
        { label: "Finanzas", href: url("/finanzas"), icon: Wallet, permission: "finance.view" },
        { label: "Monetización", href: url("/monetizacion"), icon: BadgeDollarSign, permission: "finance.withdraw" },
      ],
    },
    {
      label: "Emisora",
      items: [
        { label: "Perfil de radio", href: url("/perfil"), icon: AudioLines, permission: "station.profile" },
        {
          label: "Configuración",
          href: url("/configuracion"),
          icon: Settings2,
          permission: "station.settings",
          children: [
            { label: "Frecuencia", href: url("/configuracion/frecuencia") },
            { label: "Transmisión", href: url("/configuracion/transmision") },
            { label: "Audio", href: url("/configuracion/audio") },
            { label: "Automatización", href: url("/configuracion/automatizacion") },
            { label: "Mensajes", href: url("/configuracion/mensajes") },
            { label: "Regalos", href: url("/configuracion/regalos") },
            { label: "Moderación", href: url("/configuracion/moderacion") },
            { label: "Equipo", href: url("/configuracion/equipo") },
            { label: "Notificaciones", href: url("/configuracion/notificaciones") },
            { label: "Privacidad", href: url("/configuracion/privacidad") },
            { label: "Seguridad", href: url("/configuracion/seguridad") },
          ],
        },
      ],
    },
  ];

  const visible: NavGroup[] = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || [item.permission].flat().some(can)) }))
    .filter((group) => group.items.length > 0);

  return (
    <SidebarShell
      dark
      groups={visible}
      brand={
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <StationLogo station={station} size="xs" />
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold tabular">
              {station.frequency.label} {station.frequency.band}
            </span>
            <span className="block truncate text-xs text-muted">Estudio · {studio.role_label}</span>
          </span>
        </Link>
      }
      topbar={
        <>
          <div className="flex min-w-0 items-center gap-4">
            <FrequencyTitle station={station} size="md" className="hidden md:inline-flex" />
            <StreamStatusBadge status={station.stream_status.value} />
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`${app.urls.public}/radio/${station.frequency.slug}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-muted hover:bg-raised hover:text-ink sm:inline-flex"
            >
              Ver como oyente <ExternalLink className="size-3.5" />
            </a>
            <UserMenu />
          </div>
        </>
      }
      footer={
        studio.stations.length > 1 ? (
          <div className="space-y-1">
            <p className="px-3 text-[0.68rem] font-semibold tracking-[0.14em] text-faint uppercase">Mis emisoras</p>
            {studio.stations.map((own) => (
              <Link key={own.slug} href={`/estudio/${own.slug}`} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-raised hover:text-ink">
                <span className="font-display tabular">{own.frequency}</span>
                <span className="truncate">{own.name}</span>
              </Link>
            ))}
          </div>
        ) : undefined
      }
    >
      <Head title={`${title} · ${station.frequency.display}`} />
      {children}
      <LiveChatDock />
    </SidebarShell>
  );
}
