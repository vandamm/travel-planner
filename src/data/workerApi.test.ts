import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerUnavailableError, workerFetch, workerJson, workerText } from './workerApi'

function response(body: string, contentType: string | null, status = 200): Response {
  return new Response(body, {
    status,
    headers: contentType ? { 'content-type': contentType } : {},
  })
}

/** What a host without the Worker mounted actually serves: the SPA shell, 200 OK. */
const SPA_FALLBACK = response('<!doctype html><html><body>…</body></html>', 'text/html')

afterEach(() => vi.unstubAllGlobals())

describe('workerJson', () => {
  it('parses a real JSON response', async () => {
    await expect(workerJson(response('{"id":"rome"}', 'application/json'))).resolves.toEqual({
      id: 'rome',
    })
  })

  it('accepts a charset-qualified JSON content type', async () => {
    await expect(
      workerJson(response('{"ok":true}', 'application/json; charset=utf-8')),
    ).resolves.toEqual({ ok: true })
  })

  it('names the real problem when the SPA shell comes back instead of the API', async () => {
    // The bug this guards: `res.json()` on this body threw
    // `Unexpected token '<', "<!doctype "... is not valid JSON`.
    await expect(workerJson(SPA_FALLBACK)).rejects.toThrow(WorkerUnavailableError)
    await expect(workerJson(SPA_FALLBACK)).rejects.toThrow(/Can't reach the trip service/)
    await expect(workerJson(SPA_FALLBACK)).rejects.not.toThrow(/Unexpected token/)
  })

  it('rejects a body with no content type at all', async () => {
    await expect(workerJson(response('nope', null))).rejects.toThrow(WorkerUnavailableError)
  })

  it('reports a JSON content type carrying malformed JSON', async () => {
    await expect(workerJson(response('{oops', 'application/json'))).rejects.toThrow(
      /malformed response/,
    )
  })
})

describe('workerText', () => {
  it('returns the raw body for a JSON response', async () => {
    await expect(workerText(response('{"trip":{}}', 'application/json'))).resolves.toBe(
      '{"trip":{}}',
    )
  })

  it('refuses the SPA shell rather than handing HTML to the trip parser', async () => {
    await expect(workerText(SPA_FALLBACK)).rejects.toThrow(WorkerUnavailableError)
  })
})

describe('workerFetch', () => {
  it('reports a network-level failure as an unreachable service', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )
    await expect(workerFetch('/api/rooms')).rejects.toThrow(WorkerUnavailableError)
    await expect(workerFetch('/api/rooms')).rejects.toThrow(/no response from the API/)
  })

  it('passes a successful response straight through', async () => {
    const ok = response('{"trips":[]}', 'application/json')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok)),
    )
    await expect(workerFetch('/api/rooms')).resolves.toBe(ok)
  })
})
