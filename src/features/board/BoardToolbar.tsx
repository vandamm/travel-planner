import type { Presence } from '../../data/RoomContext'
import type { SyncStatus } from '../../data/provider'
import type { TimeDirection } from './timeDirection'

export interface BoardToolbarProps {
  title: string
  meta: string
  status: SyncStatus
  presences: Presence[]
  onOpenTrip: () => void
  onOpenCities: () => void
  onOpenShare: () => void
  onOpenMenu: () => void
  onAddStay: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  direction: TimeDirection
  onToggleDirection: () => void
}

const statusText: Record<SyncStatus, string> = {
  local: 'Local',
  connecting: 'Connecting…',
  synced: 'Live',
  error: 'Offline',
  missing: 'Missing',
}

export function BoardToolbar({
  title,
  meta,
  status,
  presences,
  onOpenTrip,
  onOpenCities,
  onOpenShare,
  onOpenMenu,
  onAddStay,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  direction,
  onToggleDirection,
}: BoardToolbarProps) {
  return (
    <header
      data-testid="board-toolbar"
      className="flex items-center gap-2 border-b border-edge-150 px-3 py-3 min-[400px]:gap-3 min-[400px]:px-5"
    >
      <div
        data-testid="app-seal"
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-city-vermilion font-serif text-lg font-semibold italic leading-none text-white"
      >
        I
      </div>
      <h1 className="truncate font-serif text-[18px] font-semibold leading-none text-ink min-[400px]:text-2xl">
        {title}
      </h1>
      <button
        type="button"
        aria-label="Edit trip"
        onClick={onOpenTrip}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-card border border-edge-350 text-sm text-ink-600 hover:bg-surface-chip"
      >
        ✎
      </button>
      <span data-testid="app-meta" className="hidden border-l border-edge-150 pl-3 text-xs text-ink-500 min-[400px]:block">
        {meta}
      </span>
      <button
        type="button"
        aria-label="Cities & colours"
        onClick={onOpenCities}
        className="button-label ml-auto hidden rounded-card border border-edge-350 px-3 py-2 text-ink-600 hover:bg-surface-chip min-[400px]:block"
      >
        Cities &amp; colours
      </button>
      <button
        type="button"
        aria-label="Collaborators"
        onClick={onOpenShare}
        className="flex -space-x-1.5"
      >
        {presences.slice(0, 3).map((presence) => (
          <span
            key={presence.userId}
            data-presence-avatar
            title={presence.name}
            className="flex h-7 w-7 items-center justify-center rounded-[2px] border-2 border-white text-xs font-bold text-white"
            style={{ backgroundColor: presence.color }}
          >
            {presence.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </button>
      <span data-testid="sync-status" role="status" aria-live="polite" className="hidden items-center gap-1 text-xs text-ink-500 min-[400px]:flex">
        <span className="h-2 w-2 rounded-full bg-city-pine" />
        {statusText[status]}
      </span>
      <button
        type="button"
        onClick={onAddStay}
        className="button-label hidden rounded-card border border-edge-350 px-3 py-2 text-ink-600 hover:bg-surface-chip min-[400px]:block"
      >
        Add stay
      </button>
      <div className="hidden items-center gap-1 min-[400px]:flex">
        <button type="button" aria-label="Undo" disabled={!canUndo} onClick={onUndo} className="h-8 w-8 rounded-card border border-edge-350 text-ink-600 disabled:opacity-40">
          ↶
        </button>
        <button type="button" aria-label="Redo" disabled={!canRedo} onClick={onRedo} className="h-8 w-8 rounded-card border border-edge-350 text-ink-600 disabled:opacity-40">
          ↷
        </button>
        <button type="button" aria-label="Toggle time direction" aria-pressed={direction === 'up'} onClick={onToggleDirection} className="button-label rounded-card border border-edge-350 px-2 py-2 text-ink-600">
          {direction === 'down' ? '↓' : '↑'}
        </button>
      </div>
      <button type="button" aria-label="Menu" onClick={onOpenMenu} className="flex h-8 w-8 items-center justify-center rounded-card border border-edge-350 text-xl text-ink-600 min-[400px]:hidden">
        ≡
      </button>
    </header>
  )
}
