// An activity card's display. Purely presentational: it shows the title, an
// optional time range, an optional note, and an optional link, and reports clicks
// to `onEdit` so the owner can open the editor. Keeping it presentational makes
// it trivial to reuse (the mobile view in Task 11) and to wrap as a sortable in
// Task 7.

import type { Card as CardType } from '../../data/schema'

export interface CardProps {
  card: CardType
  /** Called with the card when the user clicks it to edit. */
  onEdit?: (card: CardType) => void
}

/** A compact, human-friendly label for a link (its host, falling back to raw). */
function linkLabel(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return link
  }
}

export function Card({ card, onEdit }: CardProps) {
  return (
    <article
      data-testid="card"
      className="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800 shadow-sm"
    >
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
