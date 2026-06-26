// Create / edit / delete an activity card. A modal form over the board. All
// writes route through the shared card mutators (`doc.ts`), so they persist
// locally and sync like everything else. Time is opt-in: the "Set a time" toggle
// turns a card into a time-bound one (auto-sorted); switching it off clears the
// times again.

import { useState, type FormEvent } from 'react'
import { addCard, removeCard, updateCard } from '../../data/doc'
import { useRoom } from '../../data/RoomProvider'
import type { Card } from '../../data/schema'

export interface CardEditorProps {
  /** The card being edited; omit for create mode. */
  card?: Card
  /** Target day for a new card (create mode). Ignored when editing. */
  dayKey?: string
  onClose: () => void
}

/** Trim to a value or `undefined` so empty fields clear rather than store "". */
function clean(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function CardEditor({ card, dayKey, onClose }: CardEditorProps) {
  const { doc } = useRoom()
  const isEdit = card !== undefined

  const [title, setTitle] = useState(card?.title ?? '')
  const [note, setNote] = useState(card?.note ?? '')
  const [link, setLink] = useState(card?.link ?? '')
  const [timed, setTimed] = useState(Boolean(card?.startTime))
  const [startTime, setStartTime] = useState(card?.startTime ?? '')
  const [endTime, setEndTime] = useState(card?.endTime ?? '')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const start = timed ? clean(startTime) : undefined
    const end = timed && start ? clean(endTime) : undefined

    if (isEdit) {
      // `undefined` clears the field, so toggling time off or emptying a field removes it.
      updateCard(doc, card.id, {
        title: trimmedTitle,
        note: clean(note),
        link: clean(link),
        startTime: start,
        endTime: end,
      })
    } else {
      if (!dayKey) return
      addCard(doc, {
        dayKey,
        title: trimmedTitle,
        note: clean(note),
        link: clean(link),
        startTime: start,
        endTime: end,
      })
    }
    onClose()
  }

  function onDelete() {
    if (card) removeCard(doc, card.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Card editor"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-800">{isEdit ? 'Edit card' : 'Add card'}</h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Card title
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Visit the Colosseum"
              className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Link
            <input
              type="url"
              // `type="url"` still accepts ftp:/mailto:/javascript: schemes; restrict
              // to http(s) to match `webLink` in tripSchema, or a saved card could
              // hold a link the doc can never export. Native validation blocks submit.
              pattern="https?://.*"
              title="Links must start with http:// or https://"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={timed}
              onChange={(e) => setTimed(e.target.checked)}
              className="h-4 w-4"
            />
            Set a time
          </label>

          {timed && (
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-600">
                Start time
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-600">
                End time
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
                />
              </label>
            </div>
          )}

          <div className="mt-1 flex items-center justify-between gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete card
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save card
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
