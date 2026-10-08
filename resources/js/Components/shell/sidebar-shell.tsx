import { Link, usePage } from "@inertiajs/react";
import { Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ContentDisclaimer } from "@/Components/legal/platform-policies";
import { PlatformNotice } from "@/Components/shell/platform-notice";
import { Flash } from "@/Components/ui/flash";
import { cn } from "@/lib/cn";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Also active on deeper URLs (default true). */
  prefix?: boolean;
  badge?: ReactNode;
  children?: { label: string; href: string }[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface SidebarShellProps {
  brand: ReactNode;
  groups: NavGroup[];
  topbar: ReactNode;
  footer?: ReactNode;
  dark?: boolean;
  /** The console desk uses the full width instead of the reading column. */
  wide?: boolean;
  children: ReactNode;
}

function isActive(current: string, item: { href: string; prefix?: boolean }): boolean {
  const path = new URL(item.href, window.location.origin).pathname;
  return item.prefix === false ? current === path : current === path || current.startsWith(`${path}/`);
}

/** Aside navigation + top bar + content, with a drawer on small screens. Shared by the studio and the admin panel. */
export function SidebarShell({ brand, groups, topbar, footer, dark = false, wide = false, children }: SidebarShellProps) {
  const { url } = usePage();
  const current = url.split("?")[0];
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [url]);

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">{brand}</div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {groups.map((group, index) => (
          <div key={group.label ?? index} className="space-y-1">
            {group.label && <p className="px-3 pb-1 text-[0.68rem] font-semibold tracking-[0.14em] text-faint uppercase">{group.label}</p>}
            {group.items.map((item) => {
              const active = isActive(current, item);
              const Icon = item.icon;
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active ? "bg-raised text-ink ring-1 ring-line" : "text-muted hover:bg-raised/60 hover:text-ink",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge}
                  </Link>
                  {item.children && active && (
                    <div className="mt-1 ml-5 space-y-0.5 border-l border-line pl-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          prefetch
                          className={cn(
                            "block rounded-lg px-3 py-1.5 text-[0.8rem] transition",
                            isActive(current, child) ? "font-medium text-ink" : "text-muted hover:text-ink",
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {footer && <div className="border-t border-line p-3">{footer}</div>}
    </nav>
  );

  return (
    <div className={cn("min-h-screen bg-canvas text-ink", dark && "theme-dark")}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 border-r border-line bg-surface lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-4 rounded-lg p-1 text-muted" aria-label="Cerrar menú">
              <X className="size-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-68">
        <PlatformNotice />
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-muted hover:text-ink lg:hidden" aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">{topbar}</div>
        </header>
        <main className={cn("mx-auto w-full px-4 py-6 sm:px-6", wide ? "max-w-[1920px] lg:py-4" : "max-w-[1600px] lg:py-8")}>{children}</main>
        <footer className="border-t border-line px-4 py-4 sm:px-6">
          <ContentDisclaimer className="max-w-3xl" />
        </footer>
      </div>
      <Flash />
    </div>
  );
}
