import { Head, Link, usePage } from "@inertiajs/react";
import { ArrowLeft, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { UserMenu } from "@/Components/shell/user-menu";
import { BrandMark, BrandName } from "@/Components/site/brand";
import { SiteFlash } from "@/Components/site/site-flash";
import SiteLayout from "@/Layouts/SiteLayout";
import { cn } from "@/lib/cn";
import type { SharedProps } from "@/types";

const sections = [
  { label: "Perfil", href: "/cuenta/perfil", icon: UserRound },
  { label: "Seguridad", href: "/cuenta/seguridad", icon: ShieldCheck },
];

function AccountBody({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { url } = usePage();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-[0.2em] text-signal uppercase">Mi cuenta</p>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <nav className="mt-6 flex gap-1 border-b border-line" aria-label="Secciones de la cuenta">
        {sections.map(({ label, href, icon: Icon }) => {
          const active = url.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}

/** Frame of the account pages: the public site layout for listeners, a light bar on the console and the control panel. */
export function AccountShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { app } = usePage<SharedProps>().props;

  if (app.host === "public") {
    return (
      <SiteLayout title={title}>
        <AccountBody title={title} description={description}>
          {children}
        </AccountBody>
      </SiteLayout>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Head title={title} />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <BrandMark />
              <span className="hidden sm:block">
                <BrandName className="block" />
                <span className="block text-xs text-muted">{app.host === "studio" ? "Consola de creadores" : "Administración"}</span>
              </span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-raised hover:text-ink">
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </div>
          <UserMenu />
        </div>
      </header>
      <AccountBody title={title} description={description}>
        {children}
      </AccountBody>
      <div className="fixed right-4 bottom-4 z-50">
        <SiteFlash />
      </div>
    </div>
  );
}
