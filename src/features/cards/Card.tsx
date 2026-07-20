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
import type { Card as CardType, CardCategory } from '../../data/schema'
import { CardResizeContext, type CardResizeEdge, type CardResizePlan } from '../board/cardResize'
import type { TimeDirection } from '../board/timeDirection'
import { cardCategory } from './cardCategory'
import { PX_PER_HOUR, resolvedDurationHours } from './cardHeight'
import { EventTimingHint } from './EventTimingHint'

/** Chip-triad token classes (text / bg / border) per category. */
const CATEGORY_CHIP: Record<CardCategory, string> = {
  indoor: 'text-indoor bg-indoor-bg border-indoor-border',
  outdoor: 'text-outdoor bg-outdoor-bg border-outdoor-border',
  transit: 'text-transit bg-transit-bg border-transit-border',
}

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
  direction?: TimeDirection
  dayStart?: string
  dayEnd?: string
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
  return `${Number(hours.toFixed(2))}h`
}

export function Card({
  card,
  conflict = false,
  onEdit,
  dragSurfaceProps,
  resizeHandleProps,
  direction = 'down',
  dayStart = '06:00',
  dayEnd = '21:00',
}: CardProps) {
  const category = cardCategory(card)
  const duration = formatDuration(resolvedDurationHours(card, dayStart, dayEnd))
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
    const atTop =
      (edge === 'start' && direction === 'down') || (edge === 'end' && direction === 'up')
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
        className={`group absolute inset-x-2 z-10 h-3 cursor-row-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-city-indigo ${atTop ? 'top-0' : 'bottom-0'} ${props.className ?? ''}`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-transparent transition-colors group-hover:bg-ink-300/40 group-focus-visible:bg-ink-300/40"
        />
      </button>
    )
  }

  return (
    <article
      {...surfaceProps}
      data-testid="card"
      data-category={category}
      aria-label={dragSurfaceProps ? `Move or edit ${card.title}` : undefined}
      onClick={editFromSurface}
      className={`relative flex h-full flex-col gap-1.5 overflow-hidden rounded-card border border-edge-100 bg-surface px-2.5 py-2 text-sm text-ink shadow-sm ${dragSurfaceProps ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${dragClassName ?? ''}`}
    >
      {card.startTime && resizeHandleProps && resizeHandle('start', resizeHandleProps.start)}
      {card.startTime && resizeHandleProps && resizeHandle('end', resizeHandleProps.end)}
      <div className="flex items-baseline gap-1">
        <button
          type="button"
          aria-label={`Edit ${card.title}`}
          data-card-action
          onClick={(event) => {
            event.stopPropagation()
            onEdit?.(card)
          }}
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left hover:text-ink"
        >
          <span
            data-testid="card-title"
            className="min-w-0 font-serif text-[15px] font-semibold leading-tight text-ink"
          >
            {card.title}
          </span>
          {
            <span
              data-testid="card-time"
              className="text-[10.5px] font-semibold tracking-[0.02em] text-ink-500"
            >
              {card.startTime ? `${card.startTime} · ${duration}` : duration}
            </span>
          }
        </button>
      </div>

      {card.note && (
        <p
          data-testid="card-note"
          className="whitespace-pre-wrap text-[11px] font-medium text-ink-500"
        >
          {card.note}
        </p>
      )}

      {(category || conflict) && (
        <div className="flex flex-wrap gap-1">
          {category && (
            <span
              data-testid="card-category"
              className={`inline-block rounded-chip border px-[7px] py-[3px] font-sans text-[9.5px] font-bold uppercase tracking-[0.05em] ${CATEGORY_CHIP[category]}`}
            >
              {category}
            </span>
          )}
          {conflict && (
            <span
              data-testid="card-conflict"
              className="inline-block rounded-chip border border-transit-border bg-transit-bg px-[7px] py-[3px] font-sans text-[9.5px] font-bold uppercase tracking-[0.05em] text-city-vermilion"
            >
              Overlap
            </span>
          )}
        </div>
      )}

      {card.link &&
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
}

export interface SortableCardProps {
  card: CardType
  conflict?: boolean
  onEdit?: (card: CardType) => void
  dayStart?: string
  dayEnd?: string
  direction?: TimeDirection
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
  direction = 'down',
  layoutStyle,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
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
    resizeController.commit(card.id, edge, sign * (event.shiftKey ? PX_PER_HOUR : PX_PER_HOUR / 4))
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
    <li ref={setNodeRef} style={style} data-testid="sortable-card">
      {isDragging || resizePreview ? (
        <EventTimingHint
          startTime={resizePreview?.startTime ?? card.startTime ?? null}
          durationHours={
            resizePreview?.durationHours ??
            resolvedDurationHours(card, dayStart ?? '06:00', dayEnd ?? '21:00')
          }
        />
      ) : (
        <Card
          card={card}
          conflict={conflict}
          onEdit={onEdit}
          dayStart={dayStart}
          dayEnd={dayEnd}
          direction={direction}
          dragSurfaceProps={{ ...attributes, ...listeners }}
          resizeHandleProps={resizeHandleProps}
        />
      )}
    </li>
  )
}
