import { RoomProvider, useRoom } from './data/RoomProvider'
import { getTrip, listCities } from './data/doc'
import { useDocVersion } from './data/useDoc'
import { Board } from './features/board/Board'
import { CityManager } from './features/cities/CityManager'
import { TripSettings } from './features/trip/TripSettings'

function Header() {
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
    </header>
  )
}

export default function App() {
  return (
    <RoomProvider>
      <main className="flex min-h-screen flex-col gap-6 bg-surface py-6 text-ink">
        <Header />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6">
          <TripSettings />
          <CityManager />
        </div>
        <Board />
      </main>
    </RoomProvider>
  )
}
