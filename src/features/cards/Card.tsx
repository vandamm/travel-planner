// An activity card's display. Purely presentational: it shows the title, an
// optional start time plus duration, an optional note, and an optional link, and reports clicks
// to `onEdit` so the owner can open the editor. Keeping it presentational makes
// it trivial to reuse (the mobile view in Task 11). `SortableCard` adds direct
// surface dragging plus accessible resize controls for timed activities.

import { useDraggable } from '@dnd-kit/core'
import {
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { Card as CardType, CardCategory, TicketState } from '../../data/schema'
import { CardResizeContext, type CardResizeEdge, type CardResizePlan } from '../board/cardResize'
import { cardCategory } from './cardCategory'
import {
  CATEGORY_GLYPH,
  CATEGORY_STYLE,
  TICKET_WASH,
  UNCATEGORISED_SURFACE,
  isShortCard,
  isTicketWashed,
  ticketMarkerState,
} from './cardPalette'
import { clockMinutes, clockString, resolvedDurationHours } from './cardHeight'
import { usePxPerHour } from '../board/timelineScale'

export interface CardProps {
  card: CardType
  /** True when this timed card collides with another activity in its day. */
  conflict?: boolean
  /** Called with the card when the user clicks it to edit. */
  onEdit?: (card: CardType) => void
  /** dnd-kit attributes + listeners attached to the whole card surface. */
  dragSurfaceProps?: HTMLAttributes<HTMLElement>
  /** Pointer/keyboard behavior for the two semantic timeline edges. */
  resizeHandleProps?: {
    start: ButtonHTMLAttributes<HTMLButtonElement>
    end: ButtonHTMLAttributes<HTMLButtonElement>
  }
  dayStart?: string
  dayEnd?: string
  /** Ephemeral timing shown while this card is moved or resized. */
  timingPreview?: {
    startTime: string | null
    durationHours: number
  }
}

/** A compact, human-friendly label for a link (its host, falling back to raw). */
function linkLabel(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return link
  }
}

/**
 * Whether a link is safe to render as a clickable anchor. Only http(s) URLs
 * qualify, so a `javascript:`/`data:` URI — which could be planted by any
 * collaborator with the secret link, or via the import / agent API — can never
 * execute when another viewer clicks the card's link.
 */
function isSafeHref(link: string): boolean {
  try {
    const { protocol } = new URL(link)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function formatDuration(hours: number): string {
  const minutes = Math.round(hours * 60)
  const wholeHours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder === 0 ? `${wholeHours}h` : `${wholeHours}h ${remainder}m`
}

/**
 * The type glyph: a small stroked mark in the category's accent, inline before
 * the title. It replaces the old chip and folded corner — with four hues on the
 * board the glyphs carry the legend, so there is no legend.
 */
function CategoryGlyph({ category }: { category: CardCategory }) {
  const { d, width } = CATEGORY_GLYPH[category]
  return (
    <svg
      data-testid="card-category-icon"
      data-category={category}
      viewBox="0 0 24 24"
      role="img"
      aria-label={CATEGORY_STYLE[category].label}
      className={`h-3 w-3 shrink-0 fill-none ${CATEGORY_STYLE[category].glyph}`}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

/** The overlap warning. Shown on every card, however short — it is not meta. */
function ConflictBadge() {
  return (
    <span
      data-testid="card-conflict"
      className="inline-block shrink-0 rounded-chip border border-transit-border bg-transit-bg px-[7px] py-[3px] font-sans text-[9.5px] font-bold uppercase tracking-[0.05em] text-city-vermilion"
    >
      Overlap
    </span>
  )
}

const TICKET_LABEL: Record<TicketState, string> = {
  none: 'No ticket needed',
  required: 'Ticket still to buy',
  bought: 'Ticket bought',
}

/**
 * The corner ticket marker. Outline = nothing to buy, filled vermilion with a
 * "!" = required and unbought (the card body also washes warm), pine with a "✓"
 * = bought.
 */
function TicketMarker({ state }: { state: TicketState }) {
  return (
    <span
      data-testid="card-ticket"
      data-ticket={state}
      title={TICKET_LABEL[state]}
      className="pointer-events-none absolute right-[10px] top-[10px] flex"
    >
      <svg viewBox="0 0 30 24" role="img" aria-label={TICKET_LABEL[state]} className="h-[19px] w-[24px] fill-none">
        {state === 'required' ? (
          <>
            <rect x="15.5" y="2" width="14" height="20" rx="2.5" className="fill-ticket-required" />
            <path d="M16.3 9h12.4" className="stroke-white" strokeWidth="1.3" strokeDasharray="1.8 1.8" />
            <path d="M5 7.2v6.6" className="stroke-ticket-required" strokeWidth="2.9" strokeLinecap="round" />
            <circle cx="5" cy="18.8" r="1.7" className="fill-ticket-required" />
          </>
        ) : state === 'bought' ? (
          <>
            <rect x="15.5" y="2" width="14" height="20" rx="2.5" className="stroke-ticket-bought" strokeWidth="1.6" />
            <path d="M16.3 9h12.4" className="stroke-ticket-bought" strokeWidth="1.3" strokeDasharray="1.8 1.8" />
            <path
              d="m1.3 13.6 3 3.1 4.6-6.5"
              className="stroke-ticket-bought"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <rect x="15.5" y="2" width="14" height="20" rx="2.5" className="stroke-ticket-none" strokeWidth="1.6" />
            <path d="M16.3 9h12.4" className="stroke-ticket-none" strokeWidth="1.3" strokeDasharray="1.8 1.8" />
          </>
        )}
      </svg>
    </span>
  )
}

export function Card({
  card,
  conflict = false,
  onEdit,
  dragSurfaceProps,
  resizeHandleProps,
  dayStart = '06:00',
  dayEnd = '21:00',
  timingPreview,
}: CardProps) {
  const pxPerHour = usePxPerHour()
  const category = cardCategory(card)
  const durationHours =
    timingPreview?.durationHours ?? resolvedDurationHours(card, dayStart, dayEnd)
  const duration = formatDuration(durationHours)
  const previewEndTime = timingPreview?.startTime
    ? clockString(clockMinutes(timingPreview.startTime) + Math.round(durationHours * 60))
    : null
  const endTime = card.startTime
    ? clockString(clockMinutes(card.startTime) + Math.round(durationHours * 60))
    : null
  const displayedTime = timingPreview
    ? timingPreview.startTime
      ? `${timingPreview.startTime} – ${previewEndTime} · ${duration}`
      : duration
    : card.startTime
      ? `${card.startTime} – ${endTime} · ${duration}`
      : duration
  const {
    className: dragClassName,
    onClick: onDragSurfaceClick,
    ...surfaceProps
  } = dragSurfaceProps ?? {}

  function editFromSurface(event: MouseEvent<HTMLElement>) {
    onDragSurfaceClick?.(event)
    if (!event.defaultPrevented) onEdit?.(card)
  }

  function resizeHandle(edge: CardResizeEdge, props: ButtonHTMLAttributes<HTMLButtonElement>) {
    const atTop = edge === 'start'
    return (
      <button
        {...props}
        type="button"
        aria-label={`Resize ${card.title} ${edge}`}
        data-card-action
        onClick={(event) => {
          event.stopPropagation()
          props.onClick?.(event)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
          props.onPointerDown?.(event)
        }}
        onPointerMove={(event) => {
          event.stopPropagation()
          props.onPointerMove?.(event)
        }}
        onPointerUp={(event) => {
          event.stopPropagation()
          props.onPointerUp?.(event)
        }}
        onPointerCancel={(event) => {
          event.stopPropagation()
          props.onPointerCancel?.(event)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          props.onKeyDown?.(event)
        }}
        className={`absolute inset-x-2 z-10 h-3 cursor-row-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-city-indigo ${atTop ? 'top-0' : 'bottom-0'} ${props.className ?? ''}`}
      />
    )
  }

  // The card's own height decides its layout: a short card collapses to one
  // line (glyph + name + time) rather than clipping its second and third rows.
  const short = isShortCard(durationHours * pxPerHour)
  const ticket = ticketMarkerState(card.ticketState, category)
  const washed = isTicketWashed(card.ticketState, category)
  const surface = category ? CATEGORY_STYLE[category].surface : UNCATEGORISED_SURFACE
  // The warm wash overrides the tint and hairline but keeps the category's left
  // edge, so a required ticket reads at a glance without losing the type.
  const bodyClass = timingPreview
    ? 'border-indoor-border bg-indoor-bg/40 shadow-none'
    : washed
      ? `${surface} ${TICKET_WASH}`
      : surface

  const titleButton = (
    <button
      type="button"
      aria-label={`Edit ${card.title}`}
      data-card-action
      onClick={(event) => {
        event.stopPropagation()
        onEdit?.(card)
      }}
      className="min-w-0 flex-1 truncate text-left hover:text-ink"
    >
      <span
        data-testid="card-title"
        className={`truncate font-serif font-semibold leading-tight text-ink ${short ? 'text-[13px]' : 'text-[14.5px]'}`}
      >
        {card.title}
      </span>
    </button>
  )

  // 2px shy of full height, with no top margin: back-to-back cards stay visually
  // separate while each card's top still equals its true start time.
  const cardContent = (
    <article
      {...surfaceProps}
      data-testid="card"
      data-category={category}
      data-short={short ? '' : undefined}
      aria-label={dragSurfaceProps ? `Move or edit ${card.title}` : undefined}
      onClick={editFromSurface}
      className={`relative flex h-[calc(100%-2px)] w-full flex-col overflow-hidden rounded-card border px-[10px] py-[8px] text-sm text-ink ${short ? 'justify-center' : 'gap-[5px]'} ${bodyClass} ${dragSurfaceProps ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${dragClassName ?? ''}`}
    >
      {card.startTime && resizeHandleProps && resizeHandle('start', resizeHandleProps.start)}
      {card.startTime && resizeHandleProps && resizeHandle('end', resizeHandleProps.end)}
      {ticket && <TicketMarker state={ticket} />}
      <div
        data-testid="card-title-row"
        className={`flex min-w-0 items-center gap-1.5 ${ticket ? 'pr-[34px]' : ''}`}
      >
        {category && <CategoryGlyph category={category} />}
        {titleButton}
        {/* The overlap warning rides the title line on every card. As its own
            row it was clipped by any card too short for three rows — and a card
            short enough to overlap invisibly is exactly the one that needs it. */}
        {conflict && <ConflictBadge />}
        {/* A short card has no second row, so its time joins the title line —
            alongside any overlap badge, since the title truncates to make room
            and dropping either would hide something the card must say. */}
        {short && (
          <span
            data-testid="card-time"
            className="shrink-0 whitespace-nowrap font-sans text-[9.5px] font-semibold text-hour-text"
          >
            {displayedTime}
          </span>
        )}
      </div>
      {!short && (
        <span
          data-testid="card-time"
          className="font-sans text-[10px] font-semibold text-ink-450"
        >
          {displayedTime}
        </span>
      )}

      {card.note && !short && (
        <p
          data-testid="card-note"
          className="whitespace-pre-wrap font-sans text-[10px] font-medium text-ink-500"
        >
          {card.note}
        </p>
      )}

      {card.link &&
        !short &&
        (isSafeHref(card.link) ? (
          <a
            data-testid="card-link"
            data-card-action
            href={card.link}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="truncate text-[11px] font-semibold text-city-indigo hover:underline"
          >
            {linkLabel(card.link)}
          </a>
        ) : (
          // Not an http(s) URL — show it as inert text rather than a clickable
          // anchor so a dangerous scheme can't run.
          <span data-testid="card-link" className="truncate text-[11px] text-ink-400">
            {card.link}
          </span>
        ))}
    </article>
  )

  if (!timingPreview) return cardContent

  return (
    <div className="relative h-full">
      <span
        data-testid="event-timing-start"
        className="absolute left-1/2 -top-5 z-10 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] font-medium leading-none text-ink-600"
      >
        {timingPreview.startTime ?? '—'}
      </span>
      {cardContent}
      <span
        data-testid="event-timing-end"
        className="absolute left-1/2 -bottom-5 z-10 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] font-medium leading-none text-ink-600"
      >
        {previewEndTime ?? '—'}
      </span>
    </div>
  )
}

export interface SortableCardProps {
  card: CardType
  conflict?: boolean
  onEdit?: (card: CardType) => void
  dayStart?: string
  dayEnd?: string
  /** Layout for the sortable list item, including its preceding drop area. */
  layoutStyle?: CSSProperties
}

/**
 * A card made draggable via dnd-kit. Its final timeline position determines its
 * start time; the day body is the drop target.
 */
export function SortableCard({
  card,
  conflict,
  onEdit,
  dayStart,
  dayEnd,
  layoutStyle,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const pxPerHour = usePxPerHour()
  const resizeController = useContext(CardResizeContext)
  const pointerResize = useRef<{
    pointerId: number
    edge: CardResizeEdge
    originY: number
    lastDeltaPx: number
    target: HTMLButtonElement
    initialPlan: CardResizePlan | null
    lastPlan: CardResizePlan | null
  } | null>(null)
  const [resizePreview, setResizePreview] = useState<CardResizePlan | null>(null)

  useEffect(() => {
    document.body.classList.toggle('cursor-row-resize', Boolean(resizePreview))
    return () => document.body.classList.remove('cursor-row-resize')
  }, [resizePreview])

  function previewDiffers(initial: CardResizePlan | null, current: CardResizePlan | null): boolean {
    return (
      !!initial &&
      !!current &&
      (initial.startTime !== current.startTime || initial.durationHours !== current.durationHours)
    )
  }

  function startResize(edge: CardResizeEdge, event: PointerEvent<HTMLButtonElement>) {
    if (!resizeController) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const initialPlan = resizeController.plan(card.id, edge, 0)
    pointerResize.current = {
      pointerId: event.pointerId,
      edge,
      originY: event.clientY,
      lastDeltaPx: 0,
      target: event.currentTarget,
      initialPlan,
      lastPlan: initialPlan,
    }
    setResizePreview(initialPlan)
  }

  useEffect(() => {
    function moveResize(event: globalThis.PointerEvent) {
      const active = pointerResize.current
      if (!active || active.pointerId !== event.pointerId || !resizeController) return
      const deltaPx = event.clientY - active.originY
      active.lastDeltaPx = deltaPx
      active.lastPlan = resizeController.plan(card.id, active.edge, deltaPx)
      setResizePreview(active.lastPlan)
    }

    function finishResize(event: globalThis.PointerEvent, commit: boolean) {
      const active = pointerResize.current
      if (!active || active.pointerId !== event.pointerId) return
      if (active.target.hasPointerCapture?.(event.pointerId)) {
        active.target.releasePointerCapture(event.pointerId)
      }
      if (commit && previewDiffers(active.initialPlan, active.lastPlan)) {
        resizeController?.commit(card.id, active.edge, active.lastDeltaPx)
      }
      pointerResize.current = null
      setResizePreview(null)
    }

    const finish = (event: globalThis.PointerEvent) => finishResize(event, true)
    const cancel = (event: globalThis.PointerEvent) => finishResize(event, false)
    window.addEventListener('pointermove', moveResize, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', cancel, true)
    return () => {
      window.removeEventListener('pointermove', moveResize, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', cancel, true)
    }
  }, [card.id, resizeController])

  function keyboardResize(edge: CardResizeEdge, event: KeyboardEvent<HTMLButtonElement>) {
    const sign =
      event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowDown' || event.key === 'ArrowRight'
          ? 1
          : 0
    if (!sign || !resizeController) return
    event.preventDefault()
    resizeController.commit(card.id, edge, sign * (event.shiftKey ? pxPerHour : pxPerHour / 4))
  }

  const resizeHandleProps =
    card.startTime && resizeController
      ? {
          start: {
            onPointerDown: (event: PointerEvent<HTMLButtonElement>) => startResize('start', event),
            onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => keyboardResize('start', event),
          },
          end: {
            onPointerDown: (event: PointerEvent<HTMLButtonElement>) => startResize('end', event),
            onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => keyboardResize('end', event),
          },
        }
      : undefined

  const baseMarginTop =
    typeof layoutStyle?.marginTop === 'number'
      ? layoutStyle.marginTop
      : Number.parseFloat(String(layoutStyle?.marginTop ?? 0)) || 0

  const style: CSSProperties = {
    ...layoutStyle,
    height: resizePreview?.heightPx ?? layoutStyle?.height,
    marginTop: resizePreview ? baseMarginTop + resizePreview.topOffsetPx : layoutStyle?.marginTop,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    visibility: isDragging ? 'hidden' : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid="sortable-card"
      className="pointer-events-auto"
    >
      {isDragging || resizePreview ? (
        <Card
          card={card}
          conflict={conflict}
          dayStart={dayStart}
          dayEnd={dayEnd}
          timingPreview={{
            startTime: resizePreview?.startTime ?? card.startTime ?? null,
            durationHours:
              resizePreview?.durationHours ??
              resolvedDurationHours(card, dayStart ?? '06:00', dayEnd ?? '21:00'),
          }}
        />
      ) : (
        <Card
          card={card}
          conflict={conflict}
          onEdit={onEdit}
          dayStart={dayStart}
          dayEnd={dayEnd}
          dragSurfaceProps={{ ...attributes, ...listeners }}
          resizeHandleProps={resizeHandleProps}
        />
      )}
    </li>
  )
}
