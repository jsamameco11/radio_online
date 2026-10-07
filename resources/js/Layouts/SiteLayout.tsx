import { Head, Link, usePage } from "@inertiajs/react";
import { Compass, Disc3, Heart, History, Home, LayoutGrid, Menu, Mic2, Radio, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PlayerBar, PlayerProvider, usePlayer } from "@/Components/player";
import { PlatformNotice } from "@/Components/shell/platform-notice";
import { UserMenu } from "@/Components/shell/user-menu";
import { BrandMark, BrandName } from "@/Components/site/brand";
import { SiteFlash } from "@/Components/site/site-flash";
import { SiteSearch } from "@/Components/site/site-search";
import { ButtonLink, buttonClasses } from "@/Components/ui/button";
import { WalletChip } from "@/Components/wallet/wallet-chip";
import { cn } from "@/lib/cn";
import type { SharedProps } from "@/types";

interface SiteLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

const primary: SiteLink[] = [
  { label: "Inicio", href: "/", icon: Home },
  { label: "Explorar", href: "/explorar", icon: Compass },
  { label: "En vivo", href: "/en-vivo", icon: Radio },
  { label: "Dial", href: "/dial", icon: Disc3 },
  { label: "Categorías", href: "/categorias", icon: LayoutGrid },
];

const personal: SiteLink[] = [
  { label: "Mis radios", href: "/mis-radios", icon: Heart },
  { label: "Historial", href: "/historial", icon: History },
];

function isActive(current: string, href: string): boolean {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

function StudioCta({ className }: { className?: string }) {
  const { auth, app } = usePage<SharedProps>().props;
  if (auth.user?.has_studio) {
    return (
      <a href={app.urls.studio} className={buttonClasses("secondary", "md", className)}>
        <Mic2 className="size-4" /> Mi consola
      </a>
    );
  }
  return (
    <ButtonLink href="/crear-mi-radio" variant="primary" className={className} icon={<Mic2 className="size-4" />}>
      Crear mi radio
    </ButtonLink>
  );
}

function SiteShell({ children, title }: { children: ReactNode; title?: string }) {
  const { url } = usePage();
  const { app } = usePage<SharedProps>().props;
  const current = url.split("?")[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const { station } = usePlayer();

  useEffect(() => setMenuOpen(false), [url]);

  return (
    <div className={cn("flex min-h-screen flex-col bg-canvas text-ink", station && "pb-20")}>
      <Head title={title} />
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <PlatformNotice />

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg p-1.5 text-muted hover:text-ink lg:hidden" aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${app.name}, inicio`}>
            <BrandMark />
            <BrandName className="hidden sm:inline" />
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
            {primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={isActive(current, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  isActive(current, item.href) ? "bg-ink text-surface" : "text-muted hover:bg-raised hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <SiteSearch className="ml-auto hidden w-full max-w-xs md:block xl:max-w-sm" />

          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            {personal.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("hidden rounded-xl p-2 transition sm:inline-flex", isActive(current, item.href) ? "bg-raised text-ink" : "text-muted hover:bg-raised hover:text-ink")}
                aria-label={item.label}
                title={item.label}
              >
                <item.icon className="size-5" />
              </Link>
            ))}
            <StudioCta className="hidden xl:inline-flex" />
            <WalletChip />
            <UserMenu />
          </div>
        </div>
        <div className="border-t border-line px-4 py-2 md:hidden">
          <SiteSearch />
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 overflow-y-auto bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <BrandMark />
                <BrandName />
              </span>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg p-1 text-muted" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            <nav className="space-y-1" aria-label="Menú móvil">
              {[...primary, ...personal].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    isActive(current, item.href) ? "bg-raised text-ink ring-1 ring-line" : "text-muted hover:bg-raised hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <StudioCta className="w-full" />
          </aside>
        </div>
      )}

      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-3">
            <span className="flex items-center gap-2.5">
              <BrandMark />
              <BrandName />
            </span>
            <p className="max-w-sm text-sm text-muted">
              Cientos de frecuencias, una sola plataforma. Sintoniza radios en vivo, descubre programas y apoya a tus locutores favoritos.
            </p>
          </div>
          <nav className="space-y-2 text-sm" aria-label="Descubrir">
            <p className="font-semibold">Descubrir</p>
            {primary.slice(1).map((item) => (
              <Link key={item.href} href={item.href} className="block text-muted hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <nav className="space-y-2 text-sm" aria-label="Tu cuenta">
            <p className="font-semibold">Tu cuenta</p>
            {personal.map((item) => (
              <Link key={item.href} href={item.href} className="block text-muted hover:text-ink">
                {item.label}
              </Link>
            ))}
            <Link href="/crear-mi-radio" className="block text-muted hover:text-ink">
              Crear mi radio
            </Link>
            <Link href="/cuenta/perfil" className="block text-muted hover:text-ink">
              Perfil y seguridad
            </Link>
          </nav>
        </div>
        <p className="border-t border-line py-5 text-center text-xs text-faint">
          © {new Date().getFullYear()} {app.name}. Todas las frecuencias son virtuales.
        </p>
      </footer>

      <PlayerBar />
      <div className={cn("fixed right-4 z-50", station ? "bottom-24" : "bottom-4")}>
        <SiteFlash />
      </div>
    </div>
  );
}

/** Public platform layout: header with search and navigation, persistent live player and footer. */
export default function SiteLayout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <PlayerProvider>
      <SiteShell title={title}>{children}</SiteShell>
    </PlayerProvider>
  );
}
