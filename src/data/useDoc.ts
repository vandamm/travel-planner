// Subscribe a component to a `Y.Doc` so it re-renders on every change — local
// edits and remote sync alike. Read the doc with the `doc.ts` getters during
// render; this hook only forces the re-render when the document updates.

import { useEffect, useState } from 'react'
import type * as Y from 'yjs'

/**
 * Re-render the calling component whenever `doc` changes. Returns a
 * monotonically increasing version for callers that want a dependency key,
 * though most components can ignore it and simply read fresh values via the
 * doc getters each render.
 */
export function useDocVersion(doc: Y.Doc): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    doc.on('update', bump)
    return () => doc.off('update', bump)
  }, [doc])
  return version
}
