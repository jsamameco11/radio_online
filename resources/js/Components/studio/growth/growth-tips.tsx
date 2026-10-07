import { Link } from "@inertiajs/react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CalendarCheck, Hash, HeartHandshake, Mic2, Smartphone, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { ShareKit } from "@/Components/studio/growth/share-kit";
import { Panel } from "@/Components/ui/panel";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import type { Station } from "@/types";

interface Tip {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}

/** Actionable advice to grow: TikTok LIVE, inviting friends, consistency, hashtags, the chat and episodes. */
export function GrowthTips({ station, shareUrl }: { station: Pick<Station, "display_name">; shareUrl: string }) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const link = (href: string, label: string) => (
    <Link href={url(href)} className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline">
      {label} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );

  const tips: Tip[] = [
    {
      icon: CalendarCheck,
      title: "Sé constante",
      body: "Elige un horario fijo y respétalo todos los días. Tu audiencia se acostumbra a buscarte y tu racha crece sola.",
      action: can("schedule.manage") ? link("/programacion", "Organizar mi programación") : undefined,
    },
    {
      icon: Hash,
      title: "Usa un tema y hashtags",
      body: "Anuncia de qué vas a hablar y elige hashtags populares: así te encuentran quienes exploran la plataforma.",
      action: can("console.operate") ? link("/tema", "Publicar el tema de hoy") : undefined,
    },
    {
      icon: HeartHandshake,
      title: "Conversa con tu chat",
      body: "Saluda por su nombre a quien te escribe y agradece en vivo cada mensaje destacado y cada regalo. La gente vuelve a donde la reconocen.",
    },
    {
      icon: Mic2,
      title: "Convierte tus vivos en episodios",
      body: "Guarda la grabación de tus mejores transmisiones y publícala como episodio: sigues sumando oyentes aunque no estés al aire.",
      action: can("library.manage") ? link("/grabaciones", "Ver mis grabaciones") : undefined,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 lg:col-span-3">
        <div className="absolute -bottom-20 -left-20 size-56 rounded-full bg-signal-soft blur-2xl" aria-hidden />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-signal text-white">
              <Smartphone className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-signal uppercase">El truco para volverte viral</p>
              <h3 className="font-display text-xl font-semibold text-ink">Transmite también en TikTok LIVE</h3>
            </div>
          </div>
          <p className="text-sm text-muted">
            Mientras sales al aire en tu radio, abre un LIVE en TikTok desde tu celular. Tu audiencia de TikTok te descubre, y tú la invitas a escucharte y suscribirse aquí. Así es como muchas
            radios despegan.
          </p>
          <ol className="grid gap-2.5 sm:grid-cols-2">
            {[
              "Pon el enlace de tu radio en tu biografía de TikTok.",
              "Al empezar, y cada 15 minutos, di tu frecuencia y cómo encontrarte.",
              "Corta los mejores momentos en videos de 30 a 60 segundos y publícalos.",
              "Pide a tus seguidores que se suscriban para recibir tus próximos vivos.",
            ].map((step, index) => (
              <li key={step} className="flex gap-2.5 rounded-xl border border-line bg-raised/70 p-3 text-sm text-ink">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-signal-soft text-xs font-bold text-signal tabular">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Panel
        className="lg:col-span-2"
        title={
          <span className="inline-flex items-center gap-2">
            <UserPlus className="size-4 text-onair" aria-hidden /> Invita a tus amigos
          </span>
        }
        description="Tus primeros suscriptores llegan de tu círculo: comparte tu radio hoy mismo."
      >
        <ShareKit station={station} shareUrl={shareUrl} />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 xl:grid-cols-4">
        {tips.map((tip) => (
          <article key={tip.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
            <tip.icon className="size-5 text-gold" aria-hidden />
            <h3 className="text-sm font-semibold text-ink">{tip.title}</h3>
            <p className="flex-1 text-sm text-muted">{tip.body}</p>
            {tip.action}
          </article>
        ))}
      </div>
    </div>
  );
}
