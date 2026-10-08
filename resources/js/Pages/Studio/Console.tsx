import { router } from "@inertiajs/react";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { useState } from "react";
import { AutopilotPanel } from "@/Components/studio/console/autopilot-panel";
import { CaptureDialog } from "@/Components/studio/console/capture-dialog";
import { ConsoleBar } from "@/Components/studio/console/console-bar";
import { Decks } from "@/Components/studio/console/decks";
import { fallbackMessages } from "@/Components/studio/console/labels";
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
  const warnings = fallbackMessages(api.snapshot.autopilot);

  function toggleBank(open: boolean) {
    window.localStorage.setItem("turadio.console.pads", open ? "1" : "0");
    setBankOpen(open);
  }

  return (
    <StudioLayout title="Consola en vivo" setup={false} wide>
      <div className="space-y-3">
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

        {warnings.map((text) => (
          <p key={text} className="rounded-xl border border-gold/30 bg-gold-soft px-4 py-2 text-sm text-gold">
            {text}
          </p>
        ))}

        <div className="grid items-start gap-3 xl:grid-cols-[16.5rem_minmax(0,1fr)_auto]">
          <LibraryRail api={api} library={library} />
          <LiveTimeline api={api} library={library} day={day} timezone={timezone} />
          {bankOpen ? (
            <div className="w-full xl:w-[22rem]">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-faint uppercase">Panel derecho</p>
                <button type="button" onClick={() => toggleBank(false)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted hover:bg-raised hover:text-ink" aria-label="Replegar la botonera">
                  Replegar <PanelRightClose className="size-3.5" />
                </button>
              </div>
              <div className="desk-scroll max-h-[40rem] overflow-y-auto overscroll-contain rounded-2xl">
                <PadBank api={api} initial={pads} library={library} max={limits.pads} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toggleBank(true)}
              className="flex h-40 w-full flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-muted hover:text-ink xl:h-auto xl:min-h-40 xl:w-11 xl:flex-col"
              aria-expanded={false}
              aria-label="Mostrar la botonera"
            >
              <PanelRightOpen className="size-4" />
              <span className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase xl:[writing-mode:vertical-rl]">Botonera</span>
            </button>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <Mixer api={api} />
          <Decks api={api} library={library} />
        </div>

        <section aria-label="Consola DJ" data-region="dj-console">
          <DjConsole api={api} library={library} pads={pads} />
        </section>

        <UpcomingAlerts api={api} timezone={timezone} />

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          <LivePanel api={api} />
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
