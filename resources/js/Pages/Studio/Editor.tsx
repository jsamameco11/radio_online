import { ArrowLeft } from "lucide-react";
import { Chooser } from "@/Components/studio/editor/chooser";
import { EditorWorkspace } from "@/Components/studio/editor/workspace";
import { RadioHeader } from "@/Components/studio/radio-header";
import { ButtonLink } from "@/Components/ui/button";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import type { EditorKindCount, EditorLimits, EditorListItem, EditorTrack, TrackKind } from "@/types/media";

interface Props {
  available: boolean;
  tracks: EditorListItem[];
  kinds: EditorKindCount[];
  total: number;
  track: EditorTrack | null;
  search: string;
  kind: TrackKind | null;
  limits: EditorLimits;
}

export default function Editor({ available, tracks, kinds, total, track, search, kind, limits }: Props) {
  const url = useStudioUrl();

  return (
    <StudioLayout title={track ? `${track.title} · Editor de audio` : "Editor de audio"}>
      <div className="space-y-6">
        <RadioHeader
          title="Editor de audio"
          description="Recorta canciones, jingles, comerciales y programas grabados, y mejora su sonido. Escuchas cada cambio al instante; al guardar, el audio queda editado en la biblioteca y en todo lo programado. El original se guarda aparte: siempre puedes volver a él."
          actions={
            track ? (
              <ButtonLink href={url("/editor")} variant="secondary" size="sm" icon={<ArrowLeft className="size-4" />}>
                Elegir otro audio
              </ButtonLink>
            ) : undefined
          }
        />

        {track ? (
          <EditorWorkspace key={`${track.id}-${track.edited_at ?? "original"}`} track={track} available={available} limits={limits} />
        ) : (
          <Chooser tracks={tracks} kinds={kinds} total={total} search={search} kind={kind} />
        )}
      </div>
    </StudioLayout>
  );
}
