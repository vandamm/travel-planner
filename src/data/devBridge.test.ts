import * as Y from 'yjs'
import { afterEach, describe, expect, it } from 'vitest'
import { getTrip, listAccommodations, listCards, listCities } from './doc'
import { installDevBridge } from './devBridge'

describe('installDevBridge', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('seeds the demo board once when requested in the URL', () => {
    window.history.replaceState(null, '', '/?demo=1')
    const doc = new Y.Doc()

    installDevBridge(doc)
    installDevBridge(doc)

    expect(getTrip(doc)).toMatchObject({ title: 'Berlin Weekend', numDays: 4, dayStart: '07:00' })
    expect(listCities(doc)).toHaveLength(1)
    expect(listAccommodations(doc)).toHaveLength(1)
    expect(listCards(doc)).toHaveLength(5)
  })
})
