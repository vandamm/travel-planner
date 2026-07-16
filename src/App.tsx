import { useState } from 'react'
import { Modal } from './components/Modal'
import { useRoom } from './data/RoomContext'
import { RoomProvider } from './data/RoomProvider'
import { slugFromPath } from './data/slug'
import { getTrip, listCities } from './data/doc'
import { inclusiveDayCount } from './data/days'
import { useDocVersion } from './data/useDoc'
import { Board } from './features/board/Board'
import { CityModal } from './features/cities/CityModal'
import { TripModal } from './features/trip/TripModal'
import { ShareModal } from './features/share/ShareModal'
import { HomeShell } from './features/home/HomeShell'

function Header({
  onOpenTrip,
  onOpenCities,
  onOpenMenu,
  onOpenShare,
}: {
  onOpenTrip: () => void
  onOpenCities: () => void
  onOpenMenu: () => void
  onOpenShare: () => void
}) {
  const { doc, status } = useRoom()
  useDocVersion(doc)
  const trip = getTrip(doc)
  const cityCount = listCities(doc).length
  // Wordmark is the trip title; untitled falls back to the app name.
  const wordmark = trip.title.trim() || 'Travel Planner'
  const days = inclusiveDayCount(trip.startDate, trip.endDate)
  const meta = `${days} ${days === 1 ? 'day' : 'days'} · ${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`
  const statusLabel = {
    local: 'Local',
    connecting: 'Connecting…',
    synced: 'Synced',
    error: 'Offline',
    missing: 'Missing',
  }[status]

  return (
    <header className="flex w-full items-center gap-3 px-6">
      {/* Vermilion seal — a square accent with a Lora italic monogram. */}
      <div
        data-testid="app-seal"
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] bg-city-vermilion font-serif text-xl font-semibold italic leading-none text-white"
      >
        I
      </div>
      <h1 className="font-serif text-3xl font-semibold leading-none tracking-tight text-ink">
        {wordmark}
      </h1>
      <p
        data-testid="app-meta"
        className="border-l border-edge pl-3 font-sans text-xs font-medium leading-snug text-ink-500"
      >
        {meta}
        <span
          data-testid="sync-status"
          role="status"
          aria-live="polite"
          className="block text-[10px]"
        >
          {statusLabel}
        </span>
      </p>
      {/* Desktop: inline Trip/Cities buttons. Mobile: they collapse into the ≡
          menu so the header isn't crowded on a phone. */}
      <div className="ml-auto hidden items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={onOpenTrip}
          className="rounded-card border border-edge-300 bg-white px-3 py-1.5 font-sans text-sm font-medium text-ink-600 hover:bg-surface-chip"
        >
          <span aria-hidden>✎</span> Trip
        </button>
        <button
          type="button"
          onClick={onOpenCities}
          className="rounded-card border border-edge-300 bg-white px-3 py-1.5 font-sans text-sm font-medium text-ink-600 hover:bg-surface-chip"
        >
          <span aria-hidden>◉</span> Cities
        </button>
      </div>
      <button
        type="button"
        onClick={onOpenShare}
        className="rounded-card border border-edge-300 bg-white px-3 py-1.5 font-sans text-sm font-medium text-ink-600 hover:bg-surface-chip"
        title="Share board"
      >
        <span aria-hidden>↗</span>
      </button>
      <button
        type="button"
        aria-label="Menu"
        onClick={onOpenMenu}
        className="flex h-9 w-9 items-center justify-center rounded-card border border-edge-300 bg-white text-xl leading-none text-ink-600 hover:bg-surface-chip sm:hidden"
      >
        <span aria-hidden>≡</span>
      </button>
    </header>
  )
}

/** The mobile action sheet behind the header's ≡: Trip / Cities / Add stay as
 *  large tap targets. Rendered through the shared Modal (full-screen sheet on
 *  mobile); each choice closes the menu and opens the matching editor. */
function MobileMenu({
  onClose,
  onOpenTrip,
  onOpenCities,
  onAddStay,
}: {
  onClose: () => void
  onOpenTrip: () => void
  onOpenCities: () => void
  onAddStay: () => void
}) {
  const item =
    'w-full rounded-card border border-edge-300 bg-white px-4 py-3 text-left font-sans text-base font-medium text-ink-600 hover:bg-surface-chip'
  return (
    <Modal label="Menu" onClose={onClose} className="flex w-full flex-col gap-3 lg:max-w-xs">
      <h2 className="font-serif text-xl font-semibold text-ink">Menu</h2>
      <button type="button" className={item} onClick={onOpenTrip}>
        <span aria-hidden>✎</span> Trip setup
      </button>
      <button type="button" className={item} onClick={onOpenCities}>
        <span aria-hidden>◉</span> Cities &amp; colours
      </button>
      <button type="button" className={item} onClick={onAddStay}>
        <span aria-hidden>＋</span> Add stay
      </button>
    </Modal>
  )
}

function AppShell() {
  const { status } = useRoom()
  const [tripOpen, setTripOpen] = useState(false)
  const [citiesOpen, setCitiesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // A monotonic counter, not a boolean: repeated "Add stay" taps re-open the
  // Board's create editor even without an intervening close.
  const [addStayNonce, setAddStayNonce] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)

  if (status === 'missing') return <MissingTrip />

  return (
    <main className="flex h-dvh flex-col gap-6 overflow-hidden bg-surface py-6 text-ink sm:h-auto sm:min-h-screen sm:overflow-visible">
      <Header
        onOpenTrip={() => setTripOpen(true)}
        onOpenCities={() => setCitiesOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenShare={() => setShareOpen(true)}
      />
      <Board addStayNonce={addStayNonce} />
      {menuOpen && (
        <MobileMenu
          onClose={() => setMenuOpen(false)}
          onOpenTrip={() => {
            setMenuOpen(false)
            setTripOpen(true)
          }}
          onOpenCities={() => {
            setMenuOpen(false)
            setCitiesOpen(true)
          }}
          onAddStay={() => {
            setMenuOpen(false)
            setAddStayNonce((n) => n + 1)
          }}
        />
      )}
      {tripOpen && <TripModal onClose={() => setTripOpen(false)} />}
      {citiesOpen && <CityModal onClose={() => setCitiesOpen(false)} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
    </main>
  )
}

function MissingTrip() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 text-center text-ink">
      <h1 className="font-serif text-2xl font-semibold text-ink">This trip doesn't exist.</h1>
    </main>
  )
}

/** Shown when the app is opened without a room slug. */
function NoRoom() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-ink">
      <div
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-[2px] bg-city-vermilion font-serif text-2xl font-semibold italic leading-none text-white"
      >
        I
      </div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Travel Planner</h1>
      <p className="max-w-sm font-sans text-sm text-ink-500">Open a trip using its slug URL.</p>
    </main>
  )
}

export default function App() {
  const pathname = typeof location !== 'undefined' ? location.pathname : '/'
  const roomId = slugFromPath(pathname)
  if (!roomId) return pathname === '/' ? <HomeShell /> : <NoRoom />
  return (
    <RoomProvider roomId={roomId}>
      <AppShell />
    </RoomProvider>
  )
}
