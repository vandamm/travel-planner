// Create / edit / delete an activity card. A modal form over the board. All
// writes route through the shared card mutators (`doc.ts`), so they persist
// locally and sync like everything else.
//
// Composition follows the v4 reference (panels B1 / B7): a fixed day·city
// overline — the day comes from the column this was opened from, so there is no
// day picker — then the name written straight onto an inline serif line, the
// note and link as bare rows, the four type buttons, and a "When" block reading
// `[start] for [3h 00m] [All day]`.
//
// The reference closes with a single live `Done`; this editor still buffers into
// `Save card` / `Cancel`, which is the one thing kept from the previous layout.

import { useState, type FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { Modal } from '../../components/Modal'
import { addCard, getTrip, removeCard, updateCard } from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import type { Card, CardCategory, TicketState } from '../../data/schema'
import { cardCategory } from './cardCategory'
import { CATEGORY_GLYPH, CATEGORY_STYLE } from './cardPalette'
import {
  SNAP_MINUTES,
  clockMinutes,
  clockString,
  isValidCustomDurationHours,
  resolvedDurationHours,
} from './cardHeight'

/**
 * The four activity types, in the reference's order. The selected chip takes an
 * ink border plus that category's tint, and its glyph and label its accent — the
 * same triad the board card uses, so the editor reads as a preview of the card.
 */
const CATEGORIES: { value: CardCategory; label: string }[] = [
  { value: 'indoor', label: 'Sights' },
  { value: 'food', label: 'Food' },
  { value: 'transit', label: 'Transport' },
  { value: 'outdoor', label: 'Outdoors' },
]

/** Ticket states, in escalating order; `none` is the default for a new card. */
const TICKETS: { value: TicketState; label: string }[] = [
  { value: 'none', label: 'Not needed' },
  { value: 'required', label: 'To buy' },
  { value: 'bought', label: 'Bought' },
]

export interface CardEditorProps {
  /** The card being edited; omit for create mode. */
  card?: Card
  /** Target day for a new card (create mode). Ignored when editing. */
  dayKey?: string
  /** Pre-fill a new card from a selected free timeline slot. */
  defaultStartTime?: string
  /** Length the clicked gap offers — a new card runs to the next card. */
  defaultDurationHours?: number
  /** Resolved city for the card's day, shown in the fixed day overline. */
  dayCityName?: string
  onClose: () => void
}

/** Trim to a value or `undefined` so empty fields clear rather than store "". */
function clean(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** The bordered field shell the When row's three controls share. */
const WHEN_FIELD =
  'flex h-[38px] flex-1 items-center justify-center rounded-card border border-edge bg-white'

export function CardEditor({
  card,
  dayKey,
  defaultStartTime,
  defaultDurationHours,
  dayCityName,
  onClose,
}: CardEditorProps) {
  const { doc } = useRoom()
  const trip = getTrip(doc)
  const isEdit = card !== undefined
  // The day is fixed by the column the editor was opened from — there is no day
  // picker (v4); it is shown as text so it is still obvious which day this is.
  const targetDayKey = card?.dayKey ?? dayKey

  const [title, setTitle] = useState(card?.title ?? '')
  const [note, setNote] = useState(card?.note ?? '')
  const [link, setLink] = useState(card?.link ?? '')
  const [startTime, setStartTime] = useState(card?.startTime ?? defaultStartTime ?? '')
  // Legacy `transport: true` is derived to `'transit'` so an old card pre-selects it.
  const [category, setCategory] = useState<CardCategory | undefined>(
    card ? cardCategory(card) : undefined,
  )
  // `duration` is only rewritten when the user actually touches the length, so a
  // stored half-day card stays a half-day card (and keeps tracking the trip's
  // window) unless they change it.
  const [duration, setDuration] = useState(card?.duration ?? 'custom')
  const [durationHours, setDurationHours] = useState(
    card?.durationHours ?? defaultDurationHours ?? 1,
  )
  const [ticketState, setTicketState] = useState<TicketState>(card?.ticketState ?? 'none')

  const allDay = duration === 'day'
  // What the card would actually occupy: 'day'/'half' resolve off the trip
  // window, so the h/m fields show a real length rather than an empty box.
  // `resolvedDurationHours` only reads these two fields, so a partial stands in.
  const shownHours = resolvedDurationHours(
    { duration, durationHours } as Card,
    trip.dayStart,
    trip.dayEnd,
  )
  const shownMinutes = Math.round(shownHours * 60)
  const hoursPart = Math.floor(shownMinutes / 60)
  const minutesPart = shownMinutes % 60
  const endsAt = startTime ? clockString(clockMinutes(startTime) + shownMinutes) : null

  /** Any edit to the length pins the card to an explicit custom duration. */
  function setLength(hours: number, minutes: number) {
    setDuration('custom')
    setDurationHours(Math.max(0, hours) + Math.max(0, minutes) / 60)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const start = clean(startTime)
    const customHours = duration === 'custom' ? durationHours : undefined
    if (customHours !== undefined && !isValidCustomDurationHours(customHours)) return

    if (isEdit) {
      // `undefined` clears the field, so emptying a field removes it.
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
        ticketState,
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
        ticketState,
      })
    }
    onClose()
  }

  function onDelete() {
    if (card) removeCard(doc, card.id)
    onClose()
  }

  const sectionLabel =
    'font-sans text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-300'
  /** Full-bleed rule between panels — cancels the Modal's own side padding. */
  const panel = '-mx-6 mt-4 border-t border-edge-200 px-6 pt-4'

  return (
    <Modal
      label="Card editor"
      title={isEdit ? 'Edit activity' : 'Add activity'}
      onClose={onClose}
      mobileAction={
        <button
          type="submit"
          form="card-editor-form"
          disabled={title.trim() === ''}
          className="button-label text-ink disabled:opacity-40"
        >
          Save
        </button>
      }
      className="flex w-full flex-col min-[400px]:max-w-md"
    >
      <form id="card-editor-form" onSubmit={onSubmit} className="flex flex-col">
        {/* The day is fixed by the column this was opened from, so it reads as
            text — the reference has no day picker in the activity editor. */}
        {targetDayKey && (
          <p
            data-testid="card-editor-day"
            className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-ink-450"
          >
            {format(parseISO(targetDayKey), 'EEE dd MMM')}
            {dayCityName ? ` · ${dayCityName}` : ''}
          </p>
        )}

        {/* Name, written straight onto the line — no boxed field, no label. */}
        <div className="mt-2.5 flex items-baseline gap-2 border-b border-ink-300 pb-2">
          <input
            type="text"
            autoFocus
            aria-label="Card title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this activity"
            className="min-w-0 flex-1 bg-transparent font-serif text-[23px] font-semibold leading-tight text-ink outline-none placeholder:font-medium placeholder:italic placeholder:text-ink-200"
          />
          <span
            data-testid="card-title-hint"
            className={`shrink-0 font-sans text-[9.5px] font-bold uppercase tracking-[0.1em] ${title.trim() ? 'text-ink-200' : 'text-city-vermilion/60'}`}
          >
            {title.trim() ? 'Name' : 'Required'}
          </span>
        </div>

        <textarea
          aria-label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add a note"
          className="mt-2.5 resize-none bg-transparent font-sans text-[12.5px] font-medium leading-[1.5] text-ink-600 outline-none placeholder:text-ink-300"
        />

        <div className="mt-1 flex items-center gap-[7px] border-b border-dashed border-edge pb-[7px]">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-3 w-3 shrink-0 fill-none stroke-ink-400"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M9.5 14.5 14.5 9.5" />
            <path d="M12.5 7.5 14 6a4 4 0 0 1 5.6 5.6l-1.5 1.5" />
            <path d="M11.5 16.5 10 18a4 4 0 0 1-5.6-5.6L5.9 11" />
          </svg>
          <input
            type="url"
            aria-label="Link"
            // `type="url"` still accepts ftp:/mailto:/javascript: schemes; restrict
            // to http(s) to match `webLink` in tripSchema, or a saved card could
            // hold a link the doc can never export. Native validation blocks submit.
            pattern="https?://.*"
            title="Links must start with http:// or https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Add a link"
            className="min-w-0 flex-1 bg-transparent font-sans text-[12px] font-medium text-city-indigo outline-none placeholder:text-ink-300"
          />
        </div>

        <div role="group" aria-label="Type" className="mt-3 flex gap-[5px]">
          {CATEGORIES.map((c) => {
            const active = category === c.value
            const glyph = CATEGORY_GLYPH[c.value]
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(active ? undefined : c.value)}
                className={`flex h-[30px] flex-1 items-center justify-center gap-[5px] rounded-card border font-sans text-[10.5px] ${
                  active
                    ? `border-ink font-bold ${CATEGORY_STYLE[c.value].surface} border-l`
                    : 'border-edge bg-white font-semibold text-ink-450'
                }`}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className={`h-3 w-3 shrink-0 fill-none ${active ? CATEGORY_STYLE[c.value].glyph : 'stroke-ink-200'}`}
                  strokeWidth={glyph.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={glyph.d} />
                </svg>
                {c.label}
              </button>
            )
          })}
        </div>

        <div className={panel}>
          <span className={sectionLabel}>Ticket</span>
          <div role="group" aria-label="Ticket" className="mt-2 flex gap-[5px]">
            {TICKETS.map((t) => {
              const active = ticketState === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTicketState(t.value)}
                  className={`h-[30px] flex-1 rounded-card border text-center font-sans text-[10.5px] font-semibold ${
                    active ? 'border-ink bg-ink text-white' : 'border-edge bg-white text-ink-450'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          {category === 'transit' && (
            <p className="mt-2 font-sans text-[10.5px] font-medium text-ink-400">
              Transport cards never show a ticket marker.
            </p>
          )}
        </div>

        <div className={panel}>
          <div className="flex items-baseline gap-2">
            <span className={sectionLabel}>When</span>
            <span
              data-testid="when-derived"
              className="ml-auto font-sans text-[10.5px] font-semibold text-ink-400"
            >
              {endsAt ? `ends ${endsAt} · derived` : 'optional — you can place it later'}
            </span>
          </div>

          {/* Wraps on a narrow phone so the three controls never squeeze — the
              same "split rather than wrap at 320px" rule the reference applies
              to the mobile travel-time stepper. */}
          <div className="mt-2 flex flex-wrap items-center gap-[7px]">
            <input
              type="time"
              step={SNAP_MINUTES * 60}
              aria-label="Start time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`${WHEN_FIELD} px-2 text-center font-sans text-[15px] font-semibold text-ink ${startTime ? '' : 'border-dashed text-ink-300'}`}
            />
            <span aria-hidden className="font-sans text-[11px] font-semibold text-ink-300">
              for
            </span>
            <div className={`${WHEN_FIELD} gap-1 ${allDay ? 'opacity-50' : ''}`}>
              <input
                type="number"
                aria-label="Duration hours"
                min="0"
                max="23"
                disabled={allDay}
                value={hoursPart}
                onChange={(e) => setLength(e.target.valueAsNumber || 0, minutesPart)}
                className="w-7 bg-transparent text-right font-sans text-[15px] font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span aria-hidden className="font-sans text-[11px] font-semibold text-ink-450">
                h
              </span>
              <input
                type="number"
                aria-label="Duration minutes"
                min="0"
                max="45"
                step={SNAP_MINUTES}
                disabled={allDay}
                value={String(minutesPart).padStart(2, '0')}
                onChange={(e) => setLength(hoursPart, e.target.valueAsNumber || 0)}
                className="w-7 bg-transparent text-right font-sans text-[15px] font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span aria-hidden className="font-sans text-[11px] font-semibold text-ink-450">
                m
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allDay}
              aria-label="All day"
              onClick={() => setDuration(allDay ? 'custom' : 'day')}
              className="flex h-[38px] shrink-0 items-center gap-[7px] rounded-card border border-edge bg-white px-3 font-sans text-[12.5px] font-semibold text-ink-600 max-[420px]:w-full max-[420px]:justify-between"
            >
              All day
              <span
                aria-hidden
                className={`relative h-[17px] w-[30px] rounded-full transition-colors ${allDay ? 'bg-city-vermilion' : 'bg-edge-100'}`}
              >
                <span
                  className={`absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white transition-[left] ${allDay ? 'left-[15px]' : 'left-[2px]'}`}
                />
              </span>
            </button>
          </div>
        </div>

        <div className="-mx-6 -mb-6 mt-4 flex items-center gap-2 border-t border-edge-100 bg-surface-raised px-6 py-3.5">
          {isEdit ? (
            <button
              type="button"
              onClick={onDelete}
              className="font-sans text-[12.5px] font-semibold text-city-vermilion hover:underline"
            >
              Delete card
            </button>
          ) : (
            <span
              data-testid="card-editor-hint"
              className="font-sans text-[10.5px] font-semibold text-ink-300"
            >
              {title.trim() ? '' : 'Needs a name'}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 max-[399px]:hidden">
            <button
              type="button"
              onClick={onClose}
              className="rounded-card px-3 py-2 font-sans text-[12.5px] font-semibold text-ink-600 hover:bg-surface-chip"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={title.trim() === ''}
              className="rounded-card bg-ink px-[22px] py-2.5 font-sans text-[12.5px] font-semibold text-white hover:bg-ink-frame disabled:cursor-not-allowed disabled:bg-surface-chip disabled:text-ink-300"
            >
              Save card
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
