import { Head, Link, usePage } from "@inertiajs/react";
import type { ReactNode } from "react";
import { BrandMark, BrandName } from "@/Components/site/brand";
import { SiteFlash } from "@/Components/site/site-flash";
import type { SharedProps } from "@/types";

const showcase = ["89.30", "92.10", "95.50", "97.30", "101.70", "103.30", "105.10", "107.10"];

/** What the brand panel says to each audience. */
const pitch: Record<SharedProps["app"]["host"], { area: string | null; eyebrow: string; heading: string; text: string }> = {
  public: {
    area: null,
    eyebrow: "Radio por internet",
    heading: "Cientos de frecuencias. Una sola señal: la tuya.",
    text: "Sintoniza radios en vivo, descubre programas y apoya a tus locutores favoritos.",
  },
  studio: {
    area: "Consola de creadores",
    eyebrow: "Tu frecuencia, tu estudio",
    heading: "Tu cabina te está esperando.",
    text: "Consola en vivo, programación, biblioteca, chat con tu audiencia y ganancias de tu emisora en un solo lugar.",
  },
  control: {
    area: "Administración",
    eyebrow: "Operación de la plataforma",
    heading: "Toda la señal, bajo control.",
    text: "Frecuencias, emisoras, solicitudes, pagos y moderación de toda la red.",
  },
};

interface AuthLayoutProps {
  title: string;
  heading: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Sign-in, registration and recovery screens on every host: brand panel and form side by side. */
export default function AuthLayout({ title, heading, description, footer, children }: AuthLayoutProps) {
  const { app } = usePage<SharedProps>().props;
  const copy = pitch[app.host];

  return (
    <div className="grid min-h-screen bg-canvas text-ink lg:grid-cols-[1.05fr_1fr]">
      <Head title={title} />

      <aside className="theme-dark relative hidden overflow-hidden bg-canvas text-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <span className="space-y-1">
            <BrandName className="block text-lg" />
            {copy.area && <span className="block text-xs text-muted">{copy.area}</span>}
          </span>
        </Link>

        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-[0.2em] text-signal uppercase">{copy.eyebrow}</p>
            <h2 className="max-w-md font-display text-5xl leading-[1.05] font-semibold">{copy.heading}</h2>
            <p className="max-w-md text-muted">{copy.text}</p>
          </div>

          <div className="relative rounded-3xl border border-line bg-surface p-6" aria-hidden>
            <div className="absolute inset-y-6 left-1/2 w-0.5 -translate-x-1/2 bg-signal shadow-[0_0_14px_var(--signal)]" />
            <div className="flex items-end justify-between gap-1">
              {Array.from({ length: 41 }, (_, index) => (
                <span key={index} className={index % 5 === 0 ? "h-8 w-px bg-ink" : "h-4 w-px bg-faint"} />
              ))}
            </div>
            <div className="mt-4 flex justify-between font-display text-xs text-muted tabular">
              {showcase.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-faint">© {new Date().getFullYear()} {app.name}</p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 lg:hidden">
          <BrandMark />
          <span>
            <BrandName className="block" />
            {copy.area && <span className="block text-xs text-muted">{copy.area}</span>}
          </span>
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold">{heading}</h1>
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>

      <div className="fixed right-4 bottom-4 z-50">
        <SiteFlash withStatus={false} />
      </div>
    </div>
  );
}
