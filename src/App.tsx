import { RoomProvider } from './data/RoomProvider'
import { Board } from './features/board/Board'
import { CityManager } from './features/cities/CityManager'
import { TripSettings } from './features/trip/TripSettings'

export default function App() {
  return (
    <RoomProvider>
      <main className="flex min-h-screen flex-col gap-6 bg-slate-50 py-6 text-slate-800">
        <header className="mx-auto flex w-full max-w-2xl flex-col gap-1 px-6">
          <h1 className="text-3xl font-semibold tracking-tight">Travel Planner</h1>
          <p className="text-slate-500">
            A local-first, collaborative day-board for planning a trip together.
          </p>
        </header>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6">
          <TripSettings />
          <CityManager />
        </div>
        <Board />
      </main>
    </RoomProvider>
  )
}
