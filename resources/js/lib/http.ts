/**
 * JSON requests outside Inertia visits (console heartbeats, uploads, polling).
 * Sends the session cookie and CSRF token and throws HttpError on failure.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: { message?: string; errors?: Record<string, string[]> } & Record<string, unknown>,
  ) {
    super(body.message || `Request failed with status ${status}`);
  }

  /** First validation message, or the general message. */
  firstError(): string {
    const errors = this.body.errors ? Object.values(this.body.errors).flat() : [];
    return errors[0] || this.message;
  }
}

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
}

export async function request<T = unknown>(method: string, url: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-TOKEN": csrfToken(),
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new HttpError(response.status, data);
  return data as T;
}

export const http = {
  get: <T = unknown>(url: string, init?: RequestInit) => request<T>("GET", url, undefined, init),
  post: <T = unknown>(url: string, body?: unknown, init?: RequestInit) => request<T>("POST", url, body ?? {}, init),
  put: <T = unknown>(url: string, body?: unknown, init?: RequestInit) => request<T>("PUT", url, body ?? {}, init),
  patch: <T = unknown>(url: string, body?: unknown, init?: RequestInit) => request<T>("PATCH", url, body ?? {}, init),
  delete: <T = unknown>(url: string, body?: unknown, init?: RequestInit) => request<T>("DELETE", url, body, init),
};
