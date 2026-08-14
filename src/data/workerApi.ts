// Client-side access to the Worker's HTTP API.
//
// Browser-only (it reads `import.meta.env`), so unlike its `src/data/` siblings
// it is *not* imported by the Worker itself.
//
// It exists for one reason: when the Worker is not mounted, `GET /api/rooms`
// does not fail — the SPA host answers **200 with index.html**. Every
// `if (!res.ok)` guard passes, `res.json()` then chokes on the leading `<`, and
// the user sees `Unexpected token '<', "<!doctype "... is not valid JSON`.
// Route every Worker call through here so that case is caught once, in front of
// the parse, and reported as what it actually is.

/** Base URL of the Worker; '' means same-origin (the production default). */
export function workerBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')
}

/** A Worker endpoint that answered with something other than the API. */
export class WorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerUnavailableError'
  }
}

/** In dev the cause is nearly always a Worker that was never started. */
const DEV_HINT = import.meta.env.DEV
  ? ' Start it with `npm run worker:dev` and set VITE_WORKER_URL in .env.'
  : ''

function unreachable(detail: string): WorkerUnavailableError {
  return new WorkerUnavailableError(`Can't reach the trip service — ${detail}.${DEV_HINT}`)
}

/** Whether a response actually carries a JSON body. */
function isJson(res: Response): boolean {
  return (res.headers.get('content-type') ?? '').toLowerCase().includes('application/json')
}

/**
 * `fetch` against the Worker, with a network-level failure (wrong
 * `VITE_WORKER_URL`, Worker not running, DNS) reported as a
 * {@link WorkerUnavailableError} rather than a bare "Failed to fetch".
 */
export async function workerFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${workerBase()}${path}`
  try {
    // Call with one argument when there is no init, so `fetch` is invoked the
    // same way a plain `fetch(url)` would be.
    return await (init ? fetch(url, init) : fetch(url))
  } catch {
    throw unreachable('no response from the API')
  }
}

/**
 * Parse a Worker response as JSON, refusing a non-JSON body up front. This is
 * the guard that turns the SPA's `<!doctype html>` fallback into a message that
 * names the real problem.
 */
export async function workerJson<T>(res: Response): Promise<T> {
  if (!isJson(res)) throw unreachable('the API returned a web page instead of data')
  try {
    return (await res.json()) as T
  } catch {
    throw unreachable('the API returned a malformed response')
  }
}

/** The same guard for endpoints read as raw text (a version snapshot's JSON). */
export async function workerText(res: Response): Promise<string> {
  if (!isJson(res)) throw unreachable('the API returned a web page instead of data')
  return res.text()
}
