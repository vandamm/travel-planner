// An activity card's display. Purely presentational: it shows the title, an
// optional start time plus duration, an optional note, and an optional link, and reports clicks
// to `onEdit` so the owner can open the editor. Keeping it presentational makes
// it trivial to reuse (the mobile view in Task 11). When `dragHandleProps` is
// passed (by `SortableCard`), it also renders a drag handle wired to dnd-kit.

import { useDraggable } from '@dnd-kit/core'
import type { CSSProperties, HTMLAttributes } from 'react'
import type { Card as CardType, CardCategory } from '../../data/schema'
import { cardCategory } from './cardCategory'
import { resolvedDurationHours } from './cardHeight'

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
  /**
   * dnd-kit attributes + listeners for the drag handle. When present, a grab
   * handle is rendered; dragging it reorders/moves the card. Omitted in the
   * presentational mobile view and in isolation tests.
   */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>
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
  dragHandleProps,
  dayStart = '06:00',
  dayEnd = '21:00',
}: CardProps) {
  const category = cardCategory(card)
  const duration = formatDuration(resolvedDurationHours(card, dayStart, dayEnd))
  return (
    <article
      data-testid="card"
      data-category={category}
      className="flex h-full flex-col gap-1.5 overflow-hidden rounded-card border border-edge-100 bg-surface px-[11px] py-[9px] text-sm text-ink shadow-sm min-[400px]:px-[13px] min-[400px]:py-[11px]"
    >
      <div className="flex items-baseline gap-1">
        {dragHandleProps && (
          <button
            type="button"
            aria-label={`Drag ${card.title}`}
            className="shrink-0 cursor-grab touch-none px-0.5 text-ink-300 hover:text-ink-500 active:cursor-grabbing"
            {...dragHandleProps}
          >
            ⠿
          </button>
        )}
        <button
          type="button"
          aria-label={`Edit ${card.title}`}
          onClick={() => onEdit?.(card)}
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left hover:text-ink"
        >
          <span
            data-testid="card-title"
            className="min-w-0 font-serif text-[15px] font-semibold leading-tight text-ink"
          >
            {card.title}
          </span>
          {card.startTime && (
            <span data-testid="card-time" className="text-[10.5px] font-semibold tracking-[0.02em] text-ink-500">
              {card.startTime} · {duration}
            </span>
          )}
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
            href={card.link}
            target="_blank"
            rel="noreferrer noopener"
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

  const style: CSSProperties = {
    ...layoutStyle,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <li ref={setNodeRef} style={style} data-testid="sortable-card">
      <Card
        card={card}
        conflict={conflict}
        onEdit={onEdit}
        dayStart={dayStart}
        dayEnd={dayEnd}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  )
}
