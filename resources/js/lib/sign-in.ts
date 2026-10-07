import { usePage } from "@inertiajs/react";

/** The sign-in page; once signed in with Google, the listener comes back to the page they were on. */
export function useSignInUrl(): string {
  const { url } = usePage();
  return `/ingresar?volver=${encodeURIComponent(url)}`;
}
