import { Headphones } from "lucide-react";
import { MASTER_MAX } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { DjState } from "@/lib/dj/types";
import { Knob } from "../controls/knob";
import { percentLabel } from "../labels";
import { LevelMeter } from "./level-meter";

const cueMixLabel = (value: number) => (value < 0.05 ? "CUE" : value > 0.95 ? "MST" : `${percentLabel(1 - value)}/${percentLabel(value)}`);
const talkoverLabel = (value: number) => (value < 0.02 ? "OFF" : `-${percentLabel(value)}%`);

interface MixerMasterProps {
  engine: DjEngine;
  state: DjState;
  meters: [(element: HTMLSpanElement | null) => void, (element: HTMLSpanElement | null) => void];
}

/** Centre section: master level and meters, headphones mix and volume, sampler level and talkover. */
export function MixerMaster({ engine, state, meters }: MixerMasterProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 border-x border-line px-3">
      <span className="text-[10px] font-bold tracking-widest text-muted uppercase">Master</span>
      <Knob label="Nivel" value={state.master} min={0} max={MASTER_MAX} defaultValue={0.9} onChange={(master) => engine.setMixer({ master })} format={percentLabel} tone="onair" />
      <div className="flex items-end gap-1">
        <LevelMeter cover={meters[0]} label="Master izquierdo" />
        <LevelMeter cover={meters[1]} label="Master derecho" />
      </div>
      <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest text-muted uppercase">
        <Headphones className="size-3" /> Auriculares
      </span>
      <Knob label="Mezcla" value={state.cueMix} min={0} max={1} defaultValue={0.5} onChange={(cueMix) => engine.setMixer({ cueMix })} format={cueMixLabel} size="sm" tone="gold" />
      <Knob label="Volumen" value={state.phones} min={0} max={1} defaultValue={0.8} onChange={(phones) => engine.setMixer({ phones })} format={percentLabel} size="sm" tone="gold" />
      <Knob label="Sampler" value={state.samplerVolume} min={0} max={1} defaultValue={0.8} onChange={(samplerVolume) => engine.setMixer({ samplerVolume })} format={percentLabel} size="sm" tone="info" />
      <Knob label="Talkover" value={state.talkover} min={0} max={1} defaultValue={0.5} onChange={(talkover) => engine.setTalkover(talkover)} format={talkoverLabel} size="sm" tone="ink" />
    </div>
  );
}
