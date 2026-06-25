// Dev-only test seam. Exposes the live `Y.Doc` and the doc mutators on
// `window.__planner` so Playwright (and manual debugging) can seed data before
// the data-entry UIs for it exist. Guarded by `import.meta.env.DEV`, so it is
// tree-shaken out of production builds and never ships.

import type * as Y from 'yjs'
import * as docApi from './doc'

declare global {
  interface Window {
    /** Present only in dev builds; see `installDevBridge`. */
    __planner?: { doc: Y.Doc } & typeof docApi
  }
}

export function installDevBridge(doc: Y.Doc): void {
  if (!import.meta.env.DEV) return
  if (typeof window === 'undefined') return
  window.__planner = { doc, ...docApi }
}
