import Echo from "laravel-echo";
import Pusher from "pusher-js";

/**
 * Laravel Echo over Reverb, created on first use. Without VITE_REVERB_APP_KEY
 * (local development without a WebSocket server) it is null and callers keep
 * working from their initial props.
 */
let echo: Echo<"reverb"> | null | undefined;

export function realtime(): Echo<"reverb"> | null {
  if (echo !== undefined) return echo;

  const key = import.meta.env.VITE_REVERB_APP_KEY;
  if (!key) {
    echo = null;
    return echo;
  }

  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
  const scheme = import.meta.env.VITE_REVERB_SCHEME ?? "https";
  echo = new Echo({
    broadcaster: "reverb",
    key,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 80),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
    forceTLS: scheme === "https",
    enabledTransports: ["ws", "wss"],
  });
  return echo;
}
