import { usePage } from "@inertiajs/react";
import type { SharedProps } from "@/types";

type Host = SharedProps["app"]["host"];

/** Hosts that take the session along (SessionHandoff); the control panel always asks for its own credentials. */
const handoff: Partial<Record<Host, string>> = { public: "escuchar", studio: "consola" };

/** Address of a page on any application of the platform: appUrl("studio", "/89-30") opens it already signed in. */
export function useAppUrl(): (host: Host, path?: string) => string {
  const { app, auth } = usePage<SharedProps>().props;
  return (host, path = "/") => {
    if (host === app.host) return path;
    const segment = handoff[host];
    return auth.user && segment ? `/ir/${segment}?a=${encodeURIComponent(path)}` : `${app.urls[host]}${path}`;
  };
}
