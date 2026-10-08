import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioChatMessage } from "@/types/chat";

const STORAGE_KEY = "turadio.superchat.auto";

function savedAuto(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/** A Spanish voice when the browser has one, so a Superchat sounds like the cabin. */
function spanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === "es-PE") ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ?? null;
}

function line(message: StudioChatMessage): string {
  const name = message.user?.name ?? "Un oyente";
  if (message.body.trim() === "" && message.sticker) return `Superchat. ${name} envió el sticker ${message.sticker.label}.`.slice(0, 280);
  return `Superchat de ${name}. ${message.body}`.slice(0, 280);
}

/**
 * Reads a paid chat message aloud in the cabin. «Automático» queues each new Superchat;
 * «Decir» plays that one immediately. The browser's own Spanish voice is the speaker.
 */
export function useSuperchat() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [auto, setAutoState] = useState(savedAuto);
  const [current, setCurrent] = useState<string | null>(null);
  const queue = useRef<{ id: string; text: string }[]>([]);
  const running = useRef(false);
  const token = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const prime = () => void spanishVoice();
    prime();
    window.speechSynthesis.addEventListener("voiceschanged", prime);
    return () => {
      token.current += 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener("voiceschanged", prime);
    };
  }, [supported]);

  const pump = useCallback(() => {
    if (!supported || running.current) return;
    const next = queue.current.shift();
    if (!next) {
      setCurrent(null);
      return;
    }
    const generation = token.current;
    running.current = true;
    setCurrent(next.id);
    const utter = new SpeechSynthesisUtterance(next.text);
    utter.lang = "es-PE";
    utter.rate = 0.98;
    const voice = spanishVoice();
    if (voice) utter.voice = voice;
    const finish = () => {
      if (generation !== token.current) return;
      running.current = false;
      pump();
    };
    utter.onend = finish;
    utter.onerror = finish;
    window.speechSynthesis.speak(utter);
  }, [supported]);

  const stop = useCallback(() => {
    token.current += 1;
    queue.current = [];
    running.current = false;
    if (supported) window.speechSynthesis.cancel();
    setCurrent(null);
  }, [supported]);

  const speak = useCallback(
    (message: StudioChatMessage) => {
      if (!supported || !message.highlight || message.status.value === "hidden") return;
      queue.current = queue.current.filter((entry) => entry.id !== message.id);
      queue.current.unshift({ id: message.id, text: line(message) });
      if (running.current) {
        token.current += 1;
        running.current = false;
        window.speechSynthesis.cancel();
      }
      pump();
    },
    [pump, supported],
  );

  /** A Superchat that just arrived: spoken only while the cabin left «Automático» on. */
  const offer = useCallback(
    (message: StudioChatMessage) => {
      if (!auto || !message.highlight || message.status.value !== "visible") return;
      queue.current.push({ id: message.id, text: line(message) });
      pump();
    },
    [auto, pump],
  );

  const setAuto = useCallback((value: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    setAutoState(value);
  }, []);

  return { supported, auto, setAuto, current, speak, stop, offer };
}
