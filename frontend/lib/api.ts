const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  json?: unknown;
  form?: FormData;
  query?: Query;
}

let unauthorizedHandler: (() => void) | null = null;

/** Called when a request that needs a login comes back 401 (e.g. the session expired). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// FastAPI sends `detail` as a string, or as a list of validation errors.
function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (d as { msg?: string }).msg)
      .filter((m): m is string => Boolean(m))
      .map((m) => m.replace(/^Value error, /, ""));
    if (messages.length) return messages.join(". ");
  }
  return fallback;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", json, form, query } = options;
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form; // the browser sets the multipart boundary itself
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) unauthorizedHandler?.();
    throw new ApiError(
      response.status,
      errorMessage(data, `Something went wrong (${response.status}).`),
    );
  }
  return data as T;
}

/** Download URL for an attachment; the session cookie authorises it. */
export function attachmentUrl(id: number): string {
  return buildUrl(`/attachments/${id}`);
}
