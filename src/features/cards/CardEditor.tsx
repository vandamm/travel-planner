// Create / edit / delete an activity card. A modal form over the board. All
// writes route through the shared card mutators (`doc.ts`), so they persist
// locally and sync like everything else. Time is opt-in: the "Set a time" toggle
// turns a card into a time-bound one (auto-sorted); switching it off clears the
// times again.

import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { TimePicker } from '../pickers/TimePicker'
import { addCard, removeCard, updateCard } from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import type { Card, CardCategory, CardDuration } from '../../data/schema'
import { cardCategory } from './cardCategory'

/** Type segments: category value + the triad classes shown when selected. */
const CATEGORIES: { value: CardCategory; label: string; selected: string }[] = [
  { value: 'indoor', label: 'Indoor', selected: 'border-indoor bg-indoor-bg text-indoor' },
  { value: 'outdoor', label: 'Outdoor', selected: 'border-outdoor bg-outdoor-bg text-outdoor' },
  { value: 'transit', label: 'Transit', selected: 'border-transit bg-transit-bg text-transit' },
]

const DURATIONS: { value: CardDuration; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'half', label: 'Half day' },
  { value: 'custom', label: 'Custom' },
]

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
  // Legacy `transport: true` is derived to `'transit'` so an old card pre-selects it.
  const [category, setCategory] = useState<CardCategory | undefined>(
    card ? cardCategory(card) : undefined,
  )
  const [duration, setDuration] = useState<CardDuration>(card?.duration ?? 'custom')
  const [durationHours, setDurationHours] = useState(card?.durationHours ?? 1)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const start = timed ? clean(startTime) : undefined
    const customHours = duration === 'custom' ? durationHours : undefined
    if (customHours !== undefined && customHours < 1) return

    if (isEdit) {
      // `undefined` clears the field, so toggling time off or emptying a field removes it.
      // `category` supersedes the legacy `transport` flag: always clear the latter on save.
      updateCard(doc, card.id, {
        title: trimmedTitle,
        note: clean(note),
        link: clean(link),
        startTime: start,
        duration,
        durationHours: customHours,
        transport: undefined,
        category,
      })
    } else {
      if (!dayKey) return
      addCard(doc, {
        dayKey,
        title: trimmedTitle,
        note: clean(note),
        link: clean(link),
        startTime: start,
        duration,
        durationHours: customHours,
        category,
      })
    }
    onClose()
  }

  function onDelete() {
    if (card) removeCard(doc, card.id)
    onClose()
  }

  const sectionLabel = 'text-[10px] font-bold uppercase tracking-[0.06em] text-ink-400'
  const fieldInput = 'rounded-card border border-edge px-3 py-2 text-base text-ink'

  return (
    <Modal
      label="Card editor"
      title={isEdit ? 'Edit activity' : 'Add activity'}
      onClose={onClose}
      className="flex w-full flex-col gap-4 sm:max-w-md"
    >
      <h2 className="font-serif text-xl font-semibold text-ink">
        {isEdit ? 'Edit activity' : 'Add activity'}
      </h2>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Card title</span>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Visit the Colosseum"
            className={`${fieldInput} font-serif`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={fieldInput}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Link</span>
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
            className={fieldInput}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Type</span>
          <div role="group" aria-label="Type" className="flex gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(active ? undefined : c.value)}
                  className={`flex-1 rounded-card border px-1 py-2 text-center font-sans text-xs font-bold uppercase tracking-[0.04em] ${
                    active ? c.selected : 'border-edge text-ink-500'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Duration</span>
          <div role="group" aria-label="Duration" className="flex items-center gap-1.5">
            {DURATIONS.map((s) => {
              const active = duration === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDuration(s.value)}
                  className={`flex-1 rounded-card border px-1 py-1.5 text-center font-sans text-[11.5px] font-semibold ${
                    active ? 'border-ink bg-ink text-white' : 'border-edge text-ink-600'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
            {duration === 'custom' && (
              <label className="flex shrink-0 items-center gap-1">
                <span className="sr-only">Hours</span>
                <input
                  aria-label="Duration hours"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.valueAsNumber)}
                  className="w-14 rounded-card border border-edge px-2 py-1.5 text-center text-sm text-ink"
                />
                <span aria-hidden className="text-sm text-ink-500">h</span>
              </label>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-ink-600">
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
            className="h-4 w-4"
          />
          Set a time
        </label>

        {timed && (
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className={sectionLabel}>Start time</span>
              <TimePicker
                label="Start time"
                value={startTime}
                onChange={setStartTime}
                onClear={() => setStartTime('')}
                placeholder="Set start"
                triggerClassName={`${fieldInput} text-center font-serif`}
              />
            </div>
          </div>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-card border border-transit-border px-4 py-2 text-sm font-semibold text-city-vermilion hover:bg-transit-bg"
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
              className="rounded-card px-3 py-2 text-sm font-medium text-ink-600 hover:bg-surface-chip"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={title.trim() === ''}
              className="rounded-card bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-ink-frame disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save card
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
