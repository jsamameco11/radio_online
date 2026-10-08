import { router } from "@inertiajs/react";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { useState } from "react";
import { AutopilotPanel } from "@/Components/studio/console/autopilot-panel";
import { CaptureDialog } from "@/Components/studio/console/capture-dialog";
import { ConsoleBar } from "@/Components/studio/console/console-bar";
import { Decks } from "@/Components/studio/console/decks";
import { LibraryRail } from "@/Components/studio/console/library-rail";
import { LivePanel } from "@/Components/studio/console/live-panel";
import { LiveTimeline } from "@/Components/studio/console/live-timeline";
import { Mixer } from "@/Components/studio/console/mixer";
import { PadBank } from "@/Components/studio/console/pad-bank";
import { SwitchPanel } from "@/Components/studio/console/switch-panel";
import { LaunchNow, TodayList, UpcomingAlerts } from "@/Components/studio/console/today";
import { useConsole } from "@/Components/studio/console/use-console";
import { DjConsole } from "@/Components/studio/dj/dj-console";
import { StudioGiftInbox } from "@/Components/studio/gift-inbox";
import { TopicEditor } from "@/Components/studio/topic-editor";
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

function padsOpen(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("turadio.console.pads") !== "0";
}

export default function Console({ snapshot, pads, library, playlists, kinds, day, timezone, host, capture, canEpisodes, canSchedule, limits }: Props) {
  const api = useConsole(snapshot, host, capture);
  const url = useStudioUrl();
  const can = useStudioCan();
  const { notice } = api;
  const [bankOpen, setBankOpen] = useState(padsOpen);

  function toggleBank(open: boolean) {
    window.localStorage.setItem("turadio.console.pads", open ? "1" : "0");
    setBankOpen(open);
  }

  return (
    <StudioLayout title="Consola en vivo" setup={false} wide>
      {notice ? (
        <div role="status" className={cn("mb-2 flex items-start justify-between gap-4 rounded-xl px-4 py-2.5 text-sm", notice.tone === "error" ? "bg-danger-soft text-danger" : "bg-onair-soft text-onair")}>
          <p className="min-w-0 break-words">{notice.text}</p>
          <button type="button" onClick={() => api.setNotice(null)} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="desk space-y-2 rounded-[1.4rem] border border-line-strong p-1.5 sm:p-2.5">
        <ConsoleBar api={api} timezone={timezone} />
        <SwitchPanel api={api} day={day} playlists={playlists} timezone={timezone} />
        <UpcomingAlerts api={api} timezone={timezone} />

        <div className={cn("grid items-start gap-2", bankOpen ? "xl:grid-cols-[15rem_minmax(0,1fr)_20rem]" : "xl:grid-cols-[15rem_minmax(0,1fr)_2.75rem]")}>
          <LibraryRail api={api} library={library} />
          <LiveTimeline api={api} library={library} day={day} timezone={timezone} />
          {bankOpen ? (
            <div className="flex min-w-0 flex-col xl:h-0 xl:min-h-full">
              <div className="mb-1 flex items-center justify-between px-1">
                <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-faint uppercase">Panel derecho</p>
                <button type="button" onClick={() => toggleBank(false)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted hover:bg-raised hover:text-ink" aria-label="Replegar la botonera">
                  Replegar <PanelRightClose className="size-3.5" />
                </button>
              </div>
              <div className="desk-scroll max-h-[28rem] min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl xl:max-h-none">
                <PadBank api={api} initial={pads} library={library} max={limits.pads} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toggleBank(true)}
              className="flex h-11 w-full flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface text-muted hover:text-ink xl:h-0 xl:min-h-full xl:flex-col"
              aria-expanded={false}
              aria-label="Mostrar la botonera"
            >
              <PanelRightOpen className="size-4" />
              <span className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase xl:[writing-mode:vertical-rl]">Botonera</span>
            </button>
          )}
        </div>

        <div className="grid items-start gap-2 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <Mixer api={api} />
          <Decks api={api} library={library} />
        </div>

        <div className="grid items-start gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
          <LivePanel api={api} />
          <AutopilotPanel api={api} playlists={playlists} library={library} timezone={timezone} />
          <LaunchNow api={api} library={library} />
          <TodayList day={day} now={api.now} timezone={timezone} autofill={api.snapshot.config.autofill} upcoming={api.snapshot.upcoming} scheduleUrl={canSchedule ? url("/programacion") : null} />
        </div>

        <section aria-label="Consola DJ" data-region="dj-console">
          <DjConsole api={api} library={library} pads={pads} />
        </section>

        <div className={cn("grid items-start gap-2", can("gifts.view") && "lg:grid-cols-2")}>
          <section aria-label="Tema del programa" data-region="topic-editor" className="min-w-0">
            <TopicEditor />
          </section>
          {can("gifts.view") ? (
            <section aria-label="Regalos de los oyentes" data-region="gift-inbox" className="min-w-0">
              <StudioGiftInbox />
            </section>
          ) : null}
        </div>
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
