import { useState } from 'react'
import { RoomProvider, useRoom } from './data/RoomProvider'
import { getTrip, listCities } from './data/doc'
import { useDocVersion } from './data/useDoc'
import { Board } from './features/board/Board'
import { CityModal } from './features/cities/CityModal'
import { TripModal } from './features/trip/TripModal'

function Header({ onOpenTrip, onOpenCities }: { onOpenTrip: () => void; onOpenCities: () => void }) {
  const { doc } = useRoom()
  useDocVersion(doc)
  const trip = getTrip(doc)
  const cityCount = listCities(doc).length
  // Wordmark is the trip title; untitled falls back to the app name.
  const wordmark = trip.title.trim() || 'Travel Planner'
  const days = trip.numDays
  const meta = `${days} ${days === 1 ? 'day' : 'days'} · ${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`

  return (
    <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6">
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
      </p>
      <div className="ml-auto flex items-center gap-2">
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
    </header>
  )
}

function AppShell() {
  const [tripOpen, setTripOpen] = useState(false)
  const [citiesOpen, setCitiesOpen] = useState(false)

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-surface py-6 text-ink">
      <Header onOpenTrip={() => setTripOpen(true)} onOpenCities={() => setCitiesOpen(true)} />
      <Board />
      {tripOpen && <TripModal onClose={() => setTripOpen(false)} />}
      {citiesOpen && <CityModal onClose={() => setCitiesOpen(false)} />}
    </main>
  )
}

export default function App() {
  return (
    <RoomProvider>
      <AppShell />
    </RoomProvider>
  )
}
