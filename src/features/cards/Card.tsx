// An activity card's display. Purely presentational: it shows the title, an
// optional time range, an optional note, and an optional link, and reports clicks
// to `onEdit` so the owner can open the editor. Keeping it presentational makes
// it trivial to reuse (the mobile view in Task 11). When `dragHandleProps` is
// passed (by `SortableCard`), it also renders a drag handle wired to dnd-kit.

import { useSortable } from '@dnd-kit/sortable'
import type { CSSProperties, HTMLAttributes } from 'react'
import type { Card as CardType } from '../../data/schema'

export interface CardProps {
  card: CardType
  /** Called with the card when the user clicks it to edit. */
  onEdit?: (card: CardType) => void
  /**
   * dnd-kit attributes + listeners for the drag handle. When present, a grab
   * handle is rendered; dragging it reorders/moves the card. Omitted in the
   * presentational mobile view and in isolation tests.
   */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>
}

/** A compact, human-friendly label for a link (its host, falling back to raw). */
function linkLabel(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return link
  }
}

export function Card({ card, onEdit, dragHandleProps }: CardProps) {
  return (
    <article
      data-testid="card"
      className="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800 shadow-sm"
    >
      <div className="flex items-baseline gap-1">
        {dragHandleProps && (
          <button
            type="button"
            aria-label={`Drag ${card.title}`}
            className="shrink-0 cursor-grab touch-none px-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
            {...dragHandleProps}
          >
            ⠿
          </button>
        )}
        <button
          type="button"
          aria-label={`Edit ${card.title}`}
          onClick={() => onEdit?.(card)}
          className="flex w-full items-baseline justify-between gap-2 text-left hover:text-slate-900"
        >
          <span data-testid="card-title" className="font-medium">
            {card.title}
          </span>
          {card.startTime && (
            <span data-testid="card-time" className="shrink-0 text-xs text-slate-500">
              {card.startTime}
              {card.endTime ? `–${card.endTime}` : ''}
            </span>
          )}
        </button>
      </div>

      {card.note && (
        <p data-testid="card-note" className="whitespace-pre-wrap text-xs text-slate-500">
          {card.note}
        </p>
      )}

      {card.link && (
        <a
          data-testid="card-link"
          href={card.link}
          target="_blank"
          rel="noreferrer noopener"
          className="truncate text-xs font-medium text-blue-600 hover:underline"
        >
          {linkLabel(card.link)}
        </a>
      )}
    </article>
  )
}

export interface SortableCardProps {
  card: CardType
  onEdit?: (card: CardType) => void
}

/**
 * A `Card` made draggable/sortable via dnd-kit. The card's id is the sortable
 * id; dragging the rendered handle reorders it within its day or moves it to
 * another day (see `dndHandlers.ts`). Must be rendered inside a `SortableContext`
 * (its day column) and the board's `DndContext`.
 */
export function SortableCard({ card, onEdit }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  })

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} data-testid="sortable-card">
      <Card card={card} onEdit={onEdit} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}
