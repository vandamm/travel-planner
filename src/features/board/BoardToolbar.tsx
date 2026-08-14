import type { Presence } from '../../data/RoomContext'
import type { SyncStatus } from '../../data/provider'

export interface BoardToolbarProps {
  title: string
  meta: string
  status: SyncStatus
  presences: Presence[]
  /** How many activities still need a ticket bought; 0 hides the chip. */
  ticketsToBuy?: number
  onOpenTrip: () => void
  onOpenCities: () => void
  onOpenShare: () => void
  onOpenMenu: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

const statusText: Record<SyncStatus, string> = {
  local: 'Local',
  connecting: 'Connecting…',
  synced: 'Synced',
  error: 'Offline',
  missing: 'Missing',
}

export function BoardToolbar({
  title,
  meta,
  status,
  presences,
  ticketsToBuy = 0,
  onOpenTrip,
  onOpenCities,
  onOpenShare,
  onOpenMenu,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: BoardToolbarProps) {
  return (
    <header
      data-testid="board-toolbar"
      className="flex items-center gap-2 border-b border-edge-150 px-3 py-3 min-[400px]:gap-3 min-[400px]:px-5"
    >
      <div
        data-testid="app-seal"
        aria-hidden
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[2px] bg-city-vermilion font-serif text-lg font-semibold italic leading-none text-white"
      >
        I
      </div>
      <div data-testid="app-title-block" className="min-w-0 flex-1 min-[400px]:flex-none">
        <h1 className="truncate font-serif text-[18px] font-semibold leading-none text-ink min-[400px]:text-[24px]">
          {title}
        </h1>
        {/* Trip meta and the sync dot share one sub-line, per the reference. */}
        <div
          data-testid="sync-container"
          className="hidden items-center gap-[11px] font-sans text-[11px] font-semibold text-ink-450 min-[400px]:flex"
        >
          <span data-testid="app-meta">{meta}</span>
          <span
            data-testid="sync-status"
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 font-bold text-city-pine"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-city-pine" />
            {statusText[status]}
          </span>
        </div>
      </div>
      <div data-testid="right-controls" className="ml-auto flex shrink-0 items-center gap-2">
        {ticketsToBuy > 0 && (
          <span
            data-testid="tickets-to-buy"
            className="hidden items-center gap-1.5 rounded-card border border-free-border bg-ticket-wash px-2.5 py-1.5 font-sans text-[11px] font-extrabold text-city-vermilion min-[400px]:flex"
          >
            <svg aria-hidden viewBox="0 0 18 24" className="h-[15px] w-[11px] fill-none">
              <rect x="2.8" y="2.8" width="12.4" height="18.4" rx="2.2" className="stroke-city-vermilion" strokeWidth="1.6" />
              <path d="M3.4 9h11.2" className="stroke-city-vermilion" strokeWidth="1.3" strokeDasharray="1.8 1.8" />
            </svg>
            {ticketsToBuy} {ticketsToBuy === 1 ? 'ticket' : 'tickets'} to buy
          </span>
        )}
        <button
          type="button"
          aria-label="Collaborators"
          onClick={onOpenShare}
          className="hidden -space-x-1.5 min-[400px]:flex"
        >
          {presences.slice(0, 3).map((presence) => (
            <span
              key={presence.userId}
              data-presence-avatar
              title={presence.name}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white"
              style={{ backgroundColor: presence.color }}
            >
              {presence.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </button>
        {/* Trip / Cities / Share are visible outline buttons on the desktop
            toolbar; on mobile they collapse into the ≡ menu below. */}
        <div className="hidden items-center gap-2 min-[400px]:flex">
          <button
            type="button"
            onClick={onOpenTrip}
            className="whitespace-nowrap rounded-card border border-edge-350 px-3 py-[7px] font-sans text-[12px] font-medium text-ink-600 hover:bg-surface-chip"
          >
            <span aria-hidden>✎ </span>Trip
          </button>
          <button
            type="button"
            onClick={onOpenCities}
            className="whitespace-nowrap rounded-card border border-edge-350 px-3 py-[7px] font-sans text-[12px] font-medium text-ink-600 hover:bg-surface-chip"
          >
            <span aria-hidden>◉ </span>Cities
          </button>
          <button
            type="button"
            onClick={onOpenShare}
            className="whitespace-nowrap rounded-card border border-edge-350 px-3 py-[7px] font-sans text-[12px] font-medium text-ink-600 hover:bg-surface-chip"
          >
            <span aria-hidden>↗ </span>Share
          </button>
          <span aria-hidden className="mx-[3px] h-6 w-px bg-edge-100" />
          <button type="button" aria-label="Undo" disabled={!canUndo} onClick={onUndo} className="h-8 w-[34px] rounded-card border border-edge-350 text-ink-600 disabled:opacity-40">
            ↶
          </button>
          <button type="button" aria-label="Redo" disabled={!canRedo} onClick={onRedo} className="h-8 w-[34px] rounded-card border border-edge-350 text-ink-600 disabled:opacity-40">
            ↷
          </button>
        </div>
        <button
          type="button"
          aria-label="Share trip"
          onClick={onOpenShare}
          className="flex h-8 items-center justify-center rounded-card border border-edge-350 px-2 text-xs font-semibold text-ink-600 min-[400px]:hidden"
        >
          Share
        </button>
        <button type="button" aria-label="Menu" onClick={onOpenMenu} className="flex h-8 w-8 items-center justify-center rounded-card border border-edge-350 text-xl text-ink-600 min-[400px]:hidden">
          ≡
        </button>
      </div>
    </header>
  )
}
