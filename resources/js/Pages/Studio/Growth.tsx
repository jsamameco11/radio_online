import { usePage } from "@inertiajs/react";
import { ArrowRight, Headphones, Podcast, Radio, Users } from "lucide-react";
import { AchievementBanner } from "@/Components/studio/growth/achievement-banner";
import { GoalsBoard } from "@/Components/studio/growth/goals-board";
import { GrowthTips } from "@/Components/studio/growth/growth-tips";
import { MonetizationJourney } from "@/Components/studio/growth/monetization-journey";
import { MonetizedBadge } from "@/Components/studio/growth/monetized-badge";
import { NextGoalCard } from "@/Components/studio/growth/next-goal-card";
import { StreakCard } from "@/Components/studio/growth/streak-card";
import { ButtonLink } from "@/Components/ui/button";
import { PageHeader } from "@/Components/ui/page-header";
import { Stat } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { count } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { GrowthSnapshot } from "@/types/growth";

interface Props {
  growth: GrowthSnapshot;
  shareUrl: string;
  canMonetize: boolean;
  minWithdrawalCents: number;
}

export default function Growth({ growth, shareUrl, canMonetize, minWithdrawalCents }: Props) {
  const { studio, app } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  if (!studio) return null;

  const monetization = growth.monetization;
  const cta =
    canMonetize && monetization.eligible ? (
      <ButtonLink href={url("/monetizacion")} variant="signal" icon={<ArrowRight className="size-4" />}>
        Solicitar la monetización
      </ButtonLink>
    ) : undefined;

  return (
    <StudioLayout title="Metas y crecimiento">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Crecimiento"
          title="Metas y crecimiento"
          description="Cada día al aire suma. Te acompañamos paso a paso: cumple tus metas, cuida tu racha y lleva tu radio hasta la monetización."
          actions={monetization.monetized_at ? <MonetizedBadge since={monetization.monetized_at} /> : undefined}
        />

        <AchievementBanner recent={growth.recent} />

        <NextGoalCard goal={growth.next_goal} achieved={growth.achieved_count} total={growth.goals.length} />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <StreakCard streak={growth.streak} calendar={growth.calendar} today={growth.today} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Stat label="Suscriptores" value={count(growth.metrics.subscribers)} icon={<Users className="size-4" />} hint="Personas suscritas a tu radio" />
            <Stat label="Mejor pico en vivo" value={count(growth.metrics.best_peak)} icon={<Headphones className="size-4" />} hint="Oyentes a la vez en una transmisión" />
            <Stat label="Transmisiones en vivo" value={count(growth.metrics.lives)} icon={<Radio className="size-4" />} />
            <Stat label="Episodios publicados" value={count(growth.metrics.episodes)} icon={<Podcast className="size-4" />} />
          </div>
        </div>

        <MonetizationJourney progress={monetization} minWithdrawalCents={minWithdrawalCents} currency={app.currency} action={cta} />

        <GoalsBoard goals={growth.goals} nextKey={growth.next_goal?.key ?? null} />

        <div className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Consejos para crecer</h2>
            <p className="text-sm text-muted">Lo que hacen las radios que más crecen en la plataforma.</p>
          </div>
          <GrowthTips station={studio.station} shareUrl={shareUrl} />
        </div>
      </div>
    </StudioLayout>
  );
}
