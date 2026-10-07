import { Select } from "@/Components/ui/field";
import { duration } from "@/lib/format";
import type { BroadcastTrack, TrackKind } from "@/types/studio";
import { KIND_LABEL } from "./labels";

const GROUPS: TrackKind[] = ["song", "jingle", "effect", "commercial", "program"];

interface TrackPickerProps {
  library: BroadcastTrack[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  kinds?: TrackKind[];
  className?: string;
  id?: string;
  label?: string;
}

/** A library audio, grouped by kind; audios whose file fails cannot be chosen. */
export function TrackPicker({ library, value, onChange, placeholder = "Elige un audio…", kinds = GROUPS, className, id, label }: TrackPickerProps) {
  return (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={className} aria-label={label}>
      <option value="">{placeholder}</option>
      {kinds.map((kind) => {
        const items = library.filter((item) => item.kind === kind);
        return items.length ? (
          <optgroup key={kind} label={KIND_LABEL[kind]}>
            {items.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.playable}>
                {item.title}
                {item.artist ? ` · ${item.artist}` : ""} ({duration(item.duration)})
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </Select>
  );
}
