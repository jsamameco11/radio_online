import { HttpError } from "@/lib/http";

/** Validation messages by top-level field ("featured.1" → "featured"), plus a general message. */
export function fieldErrors(error: unknown): { fields: Record<string, string>; message: string } {
  if (!(error instanceof HttpError)) return { fields: {}, message: "Algo salió mal. Inténtalo de nuevo." };
  const fields: Record<string, string> = {};
  for (const [key, messages] of Object.entries(error.body.errors ?? {})) {
    const field = key.split(".")[0];
    fields[field] ??= messages[0];
  }
  return { fields, message: error.firstError() };
}
