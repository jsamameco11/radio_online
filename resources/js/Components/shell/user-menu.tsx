import { Link, usePage } from "@inertiajs/react";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/Components/ui/avatar";
import type { SharedProps } from "@/types";

/** Account dropdown of the control host top bars. */
export function UserMenu() {
  const { auth } = usePage<SharedProps>().props;
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
        <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-xl">
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
          <Link href="/salir" method="post" as="button" className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
            <LogOut className="size-4" /> Cerrar sesión
          </Link>
        </div>
      )}
    </div>
  );
}
