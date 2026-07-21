import { useEffect, useState } from 'react'
import { Modal } from './components/Modal'
import { useRoom } from './data/RoomContext'
import { RoomProvider } from './data/RoomProvider'
import { slugFromPath } from './data/slug'
import { Board } from './features/board/Board'
import { CityModal } from './features/cities/CityModal'
import { TripModal } from './features/trip/TripModal'
import { ShareModal } from './features/share/ShareModal'
import { HomeShell } from './features/home/HomeShell'

/** The mobile action sheet behind the header's ≡: Trip / Cities / Add stay as
 *  large tap targets. Rendered through the shared Modal (full-screen sheet on
 *  mobile); each choice closes the menu and opens the matching editor. */
function MobileMenu({
  onClose,
  onOpenTrip,
  onOpenCities,
  onAddStay,
  onOpenShare,
  status,
}: {
  onClose: () => void
  onOpenTrip: () => void
  onOpenCities: () => void
  onAddStay: () => void
  onOpenShare: () => void
  status: string
}) {
  const item =
    'w-full rounded-card border border-edge-300 bg-white px-4 py-3 text-left font-sans text-base font-medium text-ink-600 hover:bg-surface-chip'
  return (
    <Modal
      label="Menu"
      onClose={onClose}
      className="flex w-full flex-col gap-3 min-[400px]:max-w-xs"
    >
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
      <button type="button" className={item} onClick={onOpenShare}>
        <span aria-hidden>↗</span> Share
      </button>
      <button
        type="button"
        className={item}
        onClick={() => void navigator.clipboard?.writeText(location.href)}
      >
        <span aria-hidden>⧉</span> Copy trip link
      </button>
      <p role="status" className="px-1 text-xs text-ink-500">
        {status === 'synced' ? 'Live' : status}
      </p>
    </Modal>
  )
}

function AppShell() {
  const { status } = useRoom()
  const [initialConnectionResolved, setInitialConnectionResolved] = useState(
    status !== 'connecting',
  )
  const [tripOpen, setTripOpen] = useState(false)
  const [citiesOpen, setCitiesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // A monotonic counter, not a boolean: repeated "Add stay" taps re-open the
  // Board's create editor even without an intervening close.
  const [addStayNonce, setAddStayNonce] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (status !== 'connecting') setInitialConnectionResolved(true)
  }, [status])

  if (status === 'connecting' && !initialConnectionResolved) {
    return (
      <main
        role="status"
        className="flex min-h-screen items-center justify-center bg-surface text-ink-500"
      >
        Loading
      </main>
    )
  }
  if (status === 'missing') return <MissingTrip />

  return (
    <main className="flex min-h-dvh flex-col bg-white text-ink">
      <Board
        addStayNonce={addStayNonce}
        onOpenTrip={() => setTripOpen(true)}
        onOpenCities={() => setCitiesOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenShare={() => setShareOpen(true)}
      />
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
          onOpenShare={() => {
            setMenuOpen(false)
            setShareOpen(true)
          }}
          status={status}
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
