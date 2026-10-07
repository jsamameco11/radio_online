import { MIDI_CONTROLS, type MidiEvent, type MidiMapping } from "./controls";
import { ddj400Mapping } from "./ddj-400";

const STORAGE_KEY = "turadio.dj.midi";
const INVERT_KEY = "turadio.dj.midi.invert-tempo";

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xb0;

/**
 * USB DJ controllers through Web MIDI: the inputs and outputs connected, the mapping of this
 * computer (saved in the browser), «Aprender» (the next control moved takes the chosen function)
 * and LED feedback on the buttons that have a light.
 */
export class DjMidi {
  inputs: string[] = [];
  mapping: MidiMapping;
  learning: string | null = null;
  /** Controllers whose tempo fader sends 0 at the bottom. */
  invertTempo: boolean;
  onEvent?: (event: MidiEvent) => void;
  onChange?: () => void;

  private access: MIDIAccess | null = null;
  private readonly controls = new Map(MIDI_CONTROLS.map((control) => [control.id, control]));

  constructor() {
    this.mapping = DjMidi.saved();
    this.invertTempo = window.localStorage.getItem(INVERT_KEY) === "1";
  }

  static supported(): boolean {
    return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
  }

  private static saved(): MidiMapping {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as MidiMapping | null;
      return saved && typeof saved === "object" ? saved : ddj400Mapping();
    } catch {
      return ddj400Mapping();
    }
  }

  async connect(): Promise<void> {
    if (this.access || !DjMidi.supported()) return;
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.attach();
    this.attach();
  }

  disconnect(): void {
    this.access?.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    this.inputs = [];
  }

  setInvertTempo(on: boolean): void {
    this.invertTempo = on;
    window.localStorage.setItem(INVERT_KEY, on ? "1" : "0");
    this.onChange?.();
  }

  learn(controlId: string | null): void {
    this.learning = controlId;
    this.onChange?.();
  }

  assignedTo(controlId: string): string | null {
    return Object.keys(this.mapping).find((key) => this.mapping[key] === controlId) ?? null;
  }

  clear(controlId: string): void {
    this.setMapping(Object.fromEntries(Object.entries(this.mapping).filter(([, id]) => id !== controlId)));
  }

  setMapping(mapping: MidiMapping): void {
    this.mapping = mapping;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
    this.onChange?.();
  }

  /** Lights (or turns off) the LED of every button mapped to a control. */
  light(controlId: string, on: boolean): void {
    if (!this.access) return;
    Object.entries(this.mapping).forEach(([key, id]) => {
      if (id !== controlId || !key.startsWith("n:")) return;
      const [, channel, number] = key.split(":").map(Number);
      this.access?.outputs.forEach((output) => {
        try {
          output.send([NOTE_ON | channel, number, on ? 0x7f : 0x00]);
        } catch {
          // An output that went away.
        }
      });
    });
  }

  private attach(): void {
    if (!this.access) return;
    const names: string[] = [];
    this.access.inputs.forEach((input) => {
      input.onmidimessage = (message) => this.receive(message.data);
      if (input.state === "connected") names.push(input.name ?? "Controlador MIDI");
    });
    this.inputs = names;
    this.onChange?.();
  }

  private receive(data: Uint8Array | null): void {
    if (!data || data.length < 3) return;
    const status = data[0] & 0xf0;
    const channel = data[0] & 0x0f;
    const number = data[1];
    const value = data[2];
    if (status !== NOTE_ON && status !== NOTE_OFF && status !== CONTROL_CHANGE) return;
    const key = `${status === CONTROL_CHANGE ? "c" : "n"}:${channel}:${number}`;

    if (this.learning) {
      if (status === NOTE_OFF || (status === NOTE_ON && value === 0)) return;
      const learning = this.learning;
      const kept = Object.fromEntries(Object.entries(this.mapping).filter(([existing, id]) => existing !== key && id !== learning));
      this.learning = null;
      this.setMapping({ ...kept, [key]: learning });
      return;
    }

    const control = this.controls.get(this.mapping[key] ?? "");
    if (!control) return;
    const pressed = status === NOTE_ON ? value > 0 : status === CONTROL_CHANGE ? value > 63 : false;
    const steps = value >= 32 && value <= 96 ? value - 64 : value < 64 ? value : value - 128;
    this.onEvent?.({ control, pressed, value: value / 127, steps });
  }
}
