import { RoomProvider } from './data/RoomProvider'
import { CityManager } from './features/cities/CityManager'
import { TripSettings } from './features/trip/TripSettings'

export default function App() {
  return (
    <RoomProvider>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-slate-50 p-6 text-slate-800">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Travel Planner</h1>
          <p className="text-slate-500">
            A local-first, collaborative day-board for planning a trip together.
          </p>
        </header>
        <TripSettings />
        <CityManager />
      </main>
    </RoomProvider>
  )
}
