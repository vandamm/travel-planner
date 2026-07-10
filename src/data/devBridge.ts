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
  if (new URLSearchParams(location.search).has('demo') && docApi.getTrip(doc).numDays === 0) {
    doc.transact(() => {
      docApi.setTrip(doc, {
        title: 'Berlin Weekend',
        startDate: '2026-07-10',
        numDays: 4,
        dayStart: '07:00',
        dayEnd: '21:00',
      })
      docApi.addCity(doc, { id: 'berlin', name: 'Berlin', color: '#4f7c74' })
      docApi.addAccommodation(doc, {
        id: 'hotel-mitte',
        label: 'Hotel Mitte',
        cityId: 'berlin',
        startNight: '2026-07-10',
        endNight: '2026-07-13',
      })
      docApi.addCard(doc, {
        id: 'brunch',
        dayKey: '2026-07-10',
        title: 'Brunch at House of Small Wonder',
        startTime: '10:00',
      })
      docApi.addCard(doc, {
        id: 'dinner',
        dayKey: '2026-07-10',
        title: 'Dinner at Lokal',
        startTime: '19:00',
      })
      docApi.addCard(doc, { id: 'museum', dayKey: '2026-07-11', title: 'Museum Island' })
      docApi.addCard(doc, { id: 'field', dayKey: '2026-07-12', title: 'Tempelhofer Feld' })
      docApi.addCard(doc, { id: 'gallery', dayKey: '2026-07-13', title: 'East Side Gallery' })
    })
  }
  window.__planner = { doc, ...docApi }
}
