import { router } from "@inertiajs/react";
import { X } from "lucide-react";
import { AutopilotPanel } from "@/Components/studio/console/autopilot-panel";
import { CaptureDialog } from "@/Components/studio/console/capture-dialog";
import { ConsoleBar } from "@/Components/studio/console/console-bar";
import { Decks } from "@/Components/studio/console/decks";
import { LivePanel } from "@/Components/studio/console/live-panel";
import { Mixer } from "@/Components/studio/console/mixer";
import { PadBank } from "@/Components/studio/console/pad-bank";
import { SwitchPanel } from "@/Components/studio/console/switch-panel";
import { LaunchNow, TodayList, UpcomingAlerts } from "@/Components/studio/console/today";
import { useConsole } from "@/Components/studio/console/use-console";
import { DjConsole } from "@/Components/studio/dj/dj-console";
import { StudioGiftInbox } from "@/Components/studio/gift-inbox";
import { TopicEditor } from "@/Components/studio/topic-editor";
import { PageHeader } from "@/Components/ui/page-header";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import type { BroadcastPlaylist, BroadcastTrack, CaptureBrief, ConsoleLimits, ConsoleSnapshot, Option, ScheduleBlock, TrackKind } from "@/types/studio";

interface Props {
  snapshot: ConsoleSnapshot;
  pads: BroadcastTrack[];
  library: BroadcastTrack[];
  playlists: BroadcastPlaylist[];
  kinds: Option<TrackKind>[];
  today: string;
  day: ScheduleBlock[];
  timezone: string;
  host: string;
  capture: CaptureBrief | null;
  canEpisodes: boolean;
  canSchedule: boolean;
  limits: ConsoleLimits;
}

export default function Console({ snapshot, pads, library, playlists, kinds, day, timezone, host, capture, canEpisodes, canSchedule, limits }: Props) {
  const api = useConsole(snapshot, host, capture);
  const url = useStudioUrl();
  const can = useStudioCan();
  const { notice } = api;

  return (
    <StudioLayout title="Consola en vivo">
      <div className="space-y-4">
        <PageHeader eyebrow="Al aire" title="Consola en vivo" description="Habla al aire, mezcla como DJ, dispara efectos y fondos, y conduce la música automática. Todo suena al instante para cada oyente." />

        {notice ? (
          <div role="status" className={cn("flex items-start justify-between gap-4 rounded-xl px-4 py-2.5 text-sm", notice.tone === "error" ? "bg-danger-soft text-danger" : "bg-onair-soft text-onair")}>
            <p>{notice.text}</p>
            <button type="button" onClick={() => api.setNotice(null)} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <ConsoleBar api={api} timezone={timezone} />
        <SwitchPanel api={api} day={day} playlists={playlists} timezone={timezone} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <LivePanel api={api} />
          <PadBank api={api} initial={pads} library={library} max={limits.pads} />
        </div>

        <section aria-label="Consola DJ" data-region="dj-console">
          <DjConsole api={api} library={library} pads={pads} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
          <Mixer api={api} />
          <Decks api={api} library={library} />
        </div>

        <UpcomingAlerts api={api} timezone={timezone} />

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <AutopilotPanel api={api} playlists={playlists} library={library} timezone={timezone} />
          <LaunchNow api={api} library={library} />
          <TodayList day={day} now={api.now} timezone={timezone} autofill={api.snapshot.config.autofill} upcoming={api.snapshot.upcoming} scheduleUrl={canSchedule ? url("/programacion") : null} />
        </div>

        <section aria-label="Tema del programa" data-region="topic-editor">
          <TopicEditor />
        </section>

        {can("gifts.view") ? (
          <section aria-label="Regalos de los oyentes" data-region="gift-inbox">
            <StudioGiftInbox />
          </section>
        ) : null}
      </div>

      {api.capture?.status === "ready" ? (
        <CaptureDialog
          base={api.base}
          recording={api.capture}
          kinds={kinds}
          canEpisodes={canEpisodes}
          title={api.title}
          onClose={api.clearCapture}
          onDone={(message) => {
            api.clearCapture();
            api.setNotice({ tone: "info", text: message });
            router.reload({ only: ["library"] });
          }}
        />
      ) : null}
    </StudioLayout>
  );
}
