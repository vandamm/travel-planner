// Nested overlays (the editor `Modal` and the field `Popover`) each register an
// Escape handler here while open. A single shared window listener dispatches
// Escape to only the top-most (most-recently-opened) handler, so one Escape
// closes just the front-most overlay — pressing it to dismiss an open picker no
// longer also closes the editor modal behind it. Capture-phase +
// `stopImmediatePropagation` so the event never reaches a stray bubble listener.
//
// ponytail: a plain module-level array, not a context/provider — two consumers,
// LIFO is all the nesting we have. Add a provider only if an overlay ever needs
// to opt out of the stack.

let handlers: Array<() => void> = []

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || handlers.length === 0) return
  e.stopImmediatePropagation()
  handlers[handlers.length - 1]()
}

/** Register `handler` as the current top-most Escape target. Returns a remover. */
export function pushEscapeHandler(handler: () => void): () => void {
  if (handlers.length === 0) window.addEventListener('keydown', onKeyDown, true)
  handlers.push(handler)
  return () => {
    handlers = handlers.filter((h) => h !== handler)
    if (handlers.length === 0) window.removeEventListener('keydown', onKeyDown, true)
  }
}
