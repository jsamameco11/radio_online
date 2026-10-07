import { HttpError } from "@/lib/http";

/**
 * Sends an audio to the studio with real progress. With direct uploads the file goes in parts
 * straight to storage (signed URLs from the server) and the form only carries the upload token;
 * otherwise the file travels inside the form. Both end in one JSON response of the server.
 */

export type Progress = (fraction: number) => void;

interface DirectUpload {
  token: string;
  part_size: number;
  urls: string[];
}

interface SendOptions {
  /** Endpoint that saves the form (library audio or episode). */
  url: string;
  /** Endpoint that opens a direct upload: ".../biblioteca/subidas". */
  uploadsUrl: string;
  fields: FormData;
  file: File | null;
  kind: string;
  direct: boolean;
  onProgress?: Progress;
  signal?: AbortSignal;
}

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
}

function parse(text: string): Record<string, unknown> {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { message: "El servidor respondió algo inesperado. Inténtalo de nuevo." };
  }
}

/** A JSON request with upload progress (fetch cannot report it). */
export function xhrJson<T>(method: string, url: string, body: FormData, onProgress?: Progress, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader("X-CSRF-TOKEN", csrfToken());
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
    xhr.onload = () => {
      const data = parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new HttpError(xhr.status, data as HttpError["body"]));
    };
    xhr.onerror = () => reject(new HttpError(0, { message: "Se cortó la conexión. Revisa tu internet e inténtalo de nuevo." }));
    xhr.onabort = () => reject(new HttpError(0, { message: "Subida cancelada." }));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/** PUT of one part to storage; resolves with its ETag. Retries twice when the connection drops. */
function putPart(url: string, blob: Blob, onProgress: Progress, signal?: AbortSignal, attempt = 0): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag.replaceAll('"', ""));
      else reject(new HttpError(xhr.status, { message: "El almacenamiento no aceptó una parte del audio. Inténtalo de nuevo." }));
    };
    xhr.onerror = () => reject(new HttpError(0, { message: "Se cortó la conexión con el almacenamiento." }));
    xhr.onabort = () => reject(new HttpError(0, { message: "Subida cancelada." }));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  }).catch((error: HttpError) => {
    if (attempt < 2 && error.status === 0 && !signal?.aborted) return putPart(url, blob, onProgress, signal, attempt + 1);
    throw error;
  });
}

async function uploadDirect(file: File, kind: string, uploadsUrl: string, onProgress: Progress, signal?: AbortSignal) {
  const open = new FormData();
  open.append("name", file.name);
  open.append("size", String(file.size));
  open.append("kind", kind);
  const upload = await xhrJson<DirectUpload>("POST", uploadsUrl, open, undefined, signal);

  const done = new Array<number>(upload.urls.length).fill(0);
  const report = () => onProgress(done.reduce((sum, value) => sum + value, 0) / file.size);
  const parts: { n: number; etag: string }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < upload.urls.length) {
      const index = next++;
      const start = index * upload.part_size;
      const blob = file.slice(start, Math.min(file.size, start + upload.part_size));
      const etag = await putPart(upload.urls[index], blob, (fraction) => {
        done[index] = fraction * blob.size;
        report();
      }, signal);
      parts.push({ n: index + 1, etag });
    }
  };

  try {
    await Promise.all([worker(), worker(), worker()]);
  } catch (error) {
    void xhrJson("DELETE", `${uploadsUrl}/${upload.token}`, new FormData()).catch(() => undefined);
    throw error;
  }

  return { token: upload.token, parts: JSON.stringify(parts.sort((a, b) => a.n - b.n)) };
}

/** Uploads the audio (if any) and saves the form; the progress covers both. */
export async function sendAudio<T>({ url, uploadsUrl, fields, file, kind, direct, onProgress, signal }: SendOptions): Promise<T> {
  const progress = onProgress ?? (() => undefined);
  if (file && direct) {
    const { token, parts } = await uploadDirect(file, kind, uploadsUrl, (fraction) => progress(fraction * 0.95), signal);
    fields.set("upload", token);
    fields.set("parts", parts);
    const saved = await xhrJson<T>("POST", url, fields, undefined, signal);
    progress(1);
    return saved;
  }
  if (file) fields.set("audio", file);
  return xhrJson<T>("POST", url, fields, progress, signal);
}

/** Appends a value as Laravel reads it from a form: arrays as "name[]", booleans as 1/0, nothing for empty values. */
export function appendField(form: FormData, name: string, value: unknown) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    value.forEach((item) => form.append(`${name}[]`, String(item)));
    return;
  }
  if (typeof value === "boolean") {
    form.append(name, value ? "1" : "0");
    return;
  }
  if (value instanceof Blob) {
    form.append(name, value);
    return;
  }
  form.append(name, typeof value === "object" ? JSON.stringify(value) : String(value));
}
