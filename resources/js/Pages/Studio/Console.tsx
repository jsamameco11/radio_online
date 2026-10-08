import { router } from "@inertiajs/react";
import { PanelRightOpen, X } from "lucide-react";
import { useState } from "react";
import { AutopilotPanel } from "@/Components/studio/console/autopilot-panel";
import { CaptureDialog } from "@/Components/studio/console/capture-dialog";
import { ConsoleBar } from "@/Components/studio/console/console-bar";
import { Decks } from "@/Components/studio/console/decks";
import { PadLoadingBar } from "@/Components/studio/console/effects-library";
import { LibraryRail } from "@/Components/studio/console/library-rail";
import { LivePanel } from "@/Components/studio/console/live-panel";
import { LiveTimeline } from "@/Components/studio/console/live-timeline";
import { Mixer } from "@/Components/studio/console/mixer";
import { PadBank } from "@/Components/studio/console/pad-bank";
import { SwitchPanel } from "@/Components/studio/console/switch-panel";
import { LaunchNow, TodayList } from "@/Components/studio/console/today";
import { UpcomingBubble } from "@/Components/studio/console/upcoming-bubble";
import { useConsole } from "@/Components/studio/console/use-console";
import { usePads } from "@/Components/studio/console/use-pads";
import { useSounds } from "@/Components/studio/console/use-sounds";
import { DjConsole } from "@/Components/studio/dj/dj-console";
import { StudioGiftInbox } from "@/Components/studio/gift-inbox";
import { RadioHeader } from "@/Components/studio/radio-header";
import { TopicEditor } from "@/Components/studio/topic-editor";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { localDate } from "@/lib/radio/format";
import type { BroadcastPlaylist, BroadcastTrack, CaptureBrief, ConsoleLimits, ConsoleSnapshot, Option, ScheduleBlock, TrackKind } from "@/types/studio";

interface Props {
  snapshot: ConsoleSnapshot;
  pads: BroadcastTrack[];
  /** A bank never set up: the basic factory effects load into it once. */
  starter: boolean;
  library: BroadcastTrack[];
  playlists: BroadcastPlaylist[];
  /** Songs of each playlist, in order. */
  playlistSongs: Record<string, string[]>;
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

export default function Console({ snapshot, pads, starter, library, playlists, playlistSongs, kinds, day, timezone, host, capture, canEpisodes, canSchedule, limits }: Props) {
  const api = useConsole(snapshot, host, capture);
  const url = useStudioUrl();
  const can = useStudioCan();
  const sounds = useSounds(api, library);
  const bank = usePads({ base: api.base, initial: pads, max: limits.pads, starter, onStored: sounds.remember });
  const { notice } = api;
  const [bankOpen, setBankOpen] = useState(padsOpen);
  const [alert, setAlert] = useState<string | null>(null);

  function toggleBank(open: boolean) {
    window.localStorage.setItem("turadio.console.pads", open ? "1" : "0");
    setBankOpen(open);
  }

  function addPad(track: BroadcastTrack) {
    if (!track.playable) {
      api.setNotice({ tone: "error", text: `«${track.title}» no se puede reproducir. Revisa el archivo en la biblioteca.` });
      return;
    }
    void bank.add(track).then((result) => result.error && api.setNotice({ tone: "error", text: result.error }));
  }

  return (
    <StudioLayout title="Consola en vivo" setup={false} wide>
      <div className="mb-3">
        <RadioHeader compact title="Consola en vivo" />
      </div>
      {notice ? (
        <div role="status" className={cn("mb-2 flex items-start justify-between gap-4 rounded-xl px-4 py-2.5 text-sm", notice.tone === "error" ? "bg-danger-soft text-danger" : "bg-onair-soft text-onair")}>
          <p className="min-w-0 break-words">{notice.text}</p>
          <button type="button" onClick={() => api.setNotice(null)} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <UpcomingBubble api={api} timezone={timezone} openId={alert} onOpen={setAlert} scheduleUrl={canSchedule ? (block) => url(`/programacion?dia=${localDate(block.start, timezone)}#bloque-${block.id}`) : null} />

      <div className="desk space-y-2 rounded-[1.4rem] border border-line-strong p-1.5 sm:p-2.5">
        <ConsoleBar api={api} timezone={timezone} />
        <SwitchPanel api={api} day={day} playlists={playlists} timezone={timezone} />
        {!bankOpen ? <PadLoadingBar bank={bank} /> : null}

        <div className={cn("grid items-start gap-2", bankOpen ? "xl:grid-cols-[15rem_minmax(0,1fr)_22rem]" : "xl:grid-cols-[15rem_minmax(0,1fr)_2.75rem]")}>
          <LibraryRail api={api} sounds={sounds} bank={bank} />
          <LiveTimeline api={api} sounds={sounds} day={day} timezone={timezone} onAlert={setAlert} />
          {bankOpen ? (
            <div className="min-w-0 self-stretch">
              <PadBank api={api} bank={bank} sounds={sounds} onAdd={addPad} onCollapse={() => toggleBank(false)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toggleBank(true)}
              className="group flex h-11 w-full flex-row items-center justify-center gap-2 self-stretch rounded-xl border border-line bg-surface text-muted shadow-[inset_0_1px_0_color-mix(in_oklab,var(--ink)_6%,transparent)] hover:border-royal/40 hover:text-ink xl:h-auto xl:flex-col xl:gap-3"
              aria-expanded={false}
              aria-label="Mostrar la botonera"
            >
              <PanelRightOpen className="size-4 text-royal" />
              <span className="text-[0.65rem] font-semibold tracking-[0.18em] uppercase xl:[writing-mode:vertical-rl]">Botonera</span>
              <span className="size-1.5 rounded-full bg-royal" aria-hidden />
            </button>
          )}
        </div>

        <div className="grid items-start gap-2 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <Mixer api={api} />
          <Decks api={api} sounds={sounds} />
        </div>

        <div className="grid items-start gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
          <LivePanel api={api} />
          <AutopilotPanel api={api} playlists={playlists} playlistSongs={playlistSongs} library={sounds.library} timezone={timezone} />
          <LaunchNow api={api} library={sounds.library} />
          <TodayList day={day} now={api.now} timezone={timezone} autofill={api.snapshot.config.autofill} upcoming={api.snapshot.upcoming} scheduleUrl={canSchedule ? url("/programacion") : null} onAlert={setAlert} />
        </div>

        <DjConsole api={api} library={sounds.library} pads={bank.pads} />

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
          limits={limits}
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
