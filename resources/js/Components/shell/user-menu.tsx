import { Link, usePage } from "@inertiajs/react";
import { ChevronDown, Headphones, LogOut, Mic2, RadioTower, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/Components/ui/avatar";
import type { SharedProps } from "@/types";

type Host = SharedProps["app"]["host"];

/** The other applications of the platform this user may jump to. */
function useOtherApps(): { host: Host; label: string; icon: LucideIcon }[] {
  const { app, auth } = usePage<SharedProps>().props;
  const apps: { host: Host; label: string; icon: LucideIcon; allowed: boolean }[] = [
    { host: "public", label: "Escuchar radios", icon: Headphones, allowed: true },
    { host: "studio", label: "Consola de creadores", icon: Mic2, allowed: Boolean(auth.user?.has_studio) },
    { host: "control", label: "Administración", icon: RadioTower, allowed: Boolean(auth.user?.is_staff) },
  ];
  return apps.filter((item) => item.allowed && item.host !== app.host);
}

/** Account dropdown of the top bars, with the way to the other applications. */
export function UserMenu() {
  const { auth, app } = usePage<SharedProps>().props;
  const others = useOtherApps();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (!auth.user) return null;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-raised" aria-expanded={open}>
        <Avatar name={auth.user.name} src={auth.user.avatar_url} size="sm" />
        <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{auth.user.name}</span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium">{auth.user.name}</p>
            <p className="truncate text-xs text-muted">{auth.user.email}</p>
          </div>
          <Link href="/cuenta/perfil" className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
            <UserRound className="size-4" /> Mi cuenta
          </Link>
          <Link href="/cuenta/seguridad" className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
            <ShieldCheck className="size-4" /> Seguridad
          </Link>
          {others.length > 0 && (
            <div className="border-t border-line py-1">
              <p className="px-4 pt-2 pb-1 text-[0.68rem] font-semibold tracking-[0.14em] text-faint uppercase">Ir a</p>
              {others.map(({ host, label, icon: Icon }) => (
                <a key={host} href={app.urls[host]} className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
                  <Icon className="size-4" /> {label}
                </a>
              ))}
            </div>
          )}
          <div className="border-t border-line py-1">
            <Link href="/salir" method="post" as="button" className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
              <LogOut className="size-4" /> Cerrar sesión
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
