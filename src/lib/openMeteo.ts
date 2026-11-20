/**
 * Open-Meteo counts its free requests per address and per day. To keep some
 * for the evening, a reply is kept a while and reused for the same request,
 * and after a refusal (429) NavIn waits before asking again.
 */

/** A forecast reply is reused for 30 minutes. */
export const OPEN_METEO_KEEP_MS = 30 * 60_000;
/** A reading of now (`current=`) only for 10 minutes. */
export const OPEN_METEO_KEEP_NOW_MS = 10 * 60_000;
/** After a refusal, no request for 10 minutes. */
export const OPEN_METEO_PAUSE_MS = 10 * 60_000;

const MAX_KEPT = 200;

const kept = new Map<string, { at: number; body: string }>();
let pausedUntil = 0;

function pauseAfterRefusal(): void {
  pausedUntil = Date.now() + OPEN_METEO_PAUSE_MS;
}

function replyOf(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * `fetch` for Open-Meteo: the same request within its keeping time is answered
 * from memory, and after a refusal it is answered 429 without asking.
 * @param url - The request.
 * @param init - Fetch options.
 * @returns The reply.
 */
export async function openMeteoFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const now = Date.now();
  const keep = url.includes('current=')
    ? OPEN_METEO_KEEP_NOW_MS
    : OPEN_METEO_KEEP_MS;
  const hit = kept.get(url);
  if (hit && now - hit.at < keep) return replyOf(hit.body);
  if (now < pausedUntil) {
    return replyOf(
      '{"error":true,"reason":"NavIn waits after a refusal"}',
      429,
    );
  }
  const reply = await fetch(url, init);
  if (reply.status === 429) {
    pauseAfterRefusal();
    return reply;
  }
  if (!reply.ok) return reply;
  const body = await reply.text();
  kept.delete(url);
  kept.set(url, { at: now, body });
  if (kept.size > MAX_KEPT) {
    const oldest = kept.keys().next().value;
    if (oldest !== undefined) kept.delete(oldest);
  }
  return replyOf(body);
}

/** Forget the kept replies and the pause (tests). */
export function forgetOpenMeteo(): void {
  kept.clear();
  pausedUntil = 0;
}
