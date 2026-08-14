// Test doubles for `fetch` that behave like a real `Response`.
//
// Hand-rolled `{ ok: true, json: async () => … }` literals are what let the
// "Unexpected token '<'" bug through: they have no headers, so they can't
// represent the case the client actually hits — a 200 carrying the SPA's
// index.html. Build real `Response`s instead.

/** A JSON response, the way the Worker actually answers. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** What a host serves when the Worker is not mounted: the SPA shell, 200 OK. */
export function spaFallbackResponse(): Response {
  return new Response('<!doctype html><html><body>app</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
