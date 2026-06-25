// Import / export the whole trip as JSON. Export downloads the current doc as a
// pretty JSON file (the same serialization the agent API returns). Import takes
// pasted text or an uploaded `.json` file, validates it against the shared zod
// schema, and — on success — replaces the doc via `applyTrip`, surfacing any
// validation error inline. All reads/writes go through the shared `src/data`
// modules, so import/export and the agent API stay in lockstep.

import { useRef, useState, type ChangeEvent } from 'react'
import { applyTrip } from '../../data/applyTrip'
import { exportTripJSON } from '../../data/exportTrip'
import { getTrip } from '../../data/doc'
import { parseTripText } from '../../data/tripSchema'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'

/** Trigger a browser download of `text` as a file named `filename`. */
function downloadFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** A filesystem-safe filename derived from the trip title. */
function exportFilename(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'trip'}.json`
}

export function ImportExport() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function onExport() {
    downloadFile(exportFilename(getTrip(doc).title), exportTripJSON(doc))
  }

  function onImport() {
    const result = parseTripText(text)
    if (!result.ok) {
      setError(result.error)
      setStatus(null)
      return
    }
    applyTrip(doc, result.data)
    setError(null)
    setStatus('Trip imported.')
    setText('')
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file
      .text()
      .then((content) => {
        setText(content)
        setError(null)
        setStatus(null)
      })
      .catch(() => setError('Could not read that file.'))
    // Allow re-selecting the same file later.
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section
      aria-labelledby="io-heading"
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="io-heading" className="text-lg font-semibold text-slate-800">
          Import / Export
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Export trip
          </button>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              setOpen((v) => !v)
              setError(null)
              setStatus(null)
            }}
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Paste JSON
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Trip JSON
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError(null)
              }}
              rows={6}
              placeholder='{ "trip": { "title": "…", "startDate": "2027-05-01", "numDays": 7 }, … }'
              className="rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-600">
              <span className="mr-2">Or upload a file</span>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                aria-label="Upload trip file"
                onChange={onFile}
                className="text-sm text-slate-600"
              />
            </label>
            <button
              type="button"
              onClick={onImport}
              disabled={!text.trim()}
              className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import trip
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
          {status && (
            <p role="status" className="text-xs font-medium text-green-700">
              {status}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
