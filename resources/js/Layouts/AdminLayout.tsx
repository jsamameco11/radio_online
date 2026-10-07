import { Head, Link, usePage } from "@inertiajs/react";
import {
  Activity,
  ArrowLeftRight,
  BadgeDollarSign,
  Banknote,
  CreditCard,
  FileClock,
  Gift,
  Inbox,
  LayoutDashboard,
  Radio,
  RadioTower,
  Settings,
  ShieldAlert,
  Tags,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NavGroup, NavItem } from "@/Components/shell/sidebar-shell";
import { SidebarShell } from "@/Components/shell/sidebar-shell";
import { UserMenu } from "@/Components/shell/user-menu";
import type { SharedProps } from "@/types";

type Item = NavItem & { permission?: string };

/** Platform control panel (super admin, admins and moderators). */
export default function AdminLayout({ title, children }: { title: string; children: ReactNode }) {
  const { auth, app } = usePage<SharedProps>().props;
  const can = (permission?: string) => !permission || Boolean(auth.user?.permissions.includes(permission));

  const groups: { label?: string; items: Item[] }[] = [
    {
      items: [
        { label: "Resumen", href: "/admin", icon: LayoutDashboard, prefix: false, permission: "dashboard.view" },
        { label: "Monitor en vivo", href: "/admin/monitor", icon: Activity, permission: "streams.monitor" },
      ],
    },
    {
      label: "Dial",
      items: [
        { label: "Frecuencias", href: "/admin/frecuencias", icon: RadioTower, permission: "frequencies.view" },
        { label: "Solicitudes", href: "/admin/solicitudes", icon: Inbox, permission: "frequency_requests.review" },
        { label: "Radios", href: "/admin/radios", icon: Radio, permission: "stations.view" },
        { label: "Categorías", href: "/admin/categorias", icon: Tags, permission: "categories.manage" },
      ],
    },
    {
      label: "Comunidad",
      items: [
        { label: "Usuarios", href: "/admin/usuarios", icon: Users, permission: "users.view" },
        { label: "Moderación", href: "/admin/moderacion", icon: ShieldAlert, permission: "moderation.manage" },
      ],
    },
    {
      label: "Finanzas",
      items: [
        { label: "Regalos", href: "/admin/regalos", icon: Gift, permission: "gifts.manage" },
        { label: "Pagos", href: "/admin/pagos", icon: CreditCard, permission: "payments.view" },
        { label: "Movimientos", href: "/admin/movimientos", icon: ArrowLeftRight, permission: "payments.view" },
        { label: "Monetización", href: "/admin/monetizacion", icon: BadgeDollarSign, permission: "monetization.review" },
        { label: "Retiros", href: "/admin/retiros", icon: Banknote, permission: "payouts.manage" },
      ],
    },
    {
      label: "Sistema",
      items: [
        { label: "Auditoría", href: "/admin/auditoria", icon: FileClock, permission: "audit.view" },
        { label: "Configuración", href: "/admin/configuracion", icon: Settings, permission: "settings.manage" },
      ],
    },
  ];

  const visible: NavGroup[] = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
    .filter((group) => group.items.length > 0);

  return (
    <SidebarShell
      groups={visible}
      brand={
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-on-primary">
            <RadioTower className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-semibold">{app.name}</span>
            <span className="block text-xs text-muted">Centro de control</span>
          </span>
        </Link>
      }
      topbar={
        <>
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          <div className="flex items-center gap-2">
            {auth.user?.has_studio && (
              <Link href="/" className="hidden rounded-xl px-3 py-1.5 text-sm text-muted hover:bg-raised hover:text-ink sm:block">
                Mis estudios
              </Link>
            )}
            <UserMenu />
          </div>
        </>
      }
    >
      <Head title={title} />
      {children}
    </SidebarShell>
  );
}
