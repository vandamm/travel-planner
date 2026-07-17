export function BoardEmptyState({ onOpenTrip }: { onOpenTrip: () => void }) {
  return (
    <div data-testid="board-empty" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div aria-hidden className="flex h-11 w-11 items-center justify-center rounded-[2px] bg-city-vermilion font-serif text-2xl font-semibold italic text-white">I</div>
      <div>
        <h2 className="font-serif text-xl font-semibold text-ink">Start your itinerary</h2>
        <p className="mt-1 text-sm text-ink-500">Add your trip dates to create the day board.</p>
      </div>
      <button type="button" onClick={onOpenTrip} className="button-label rounded-card bg-ink px-4 py-2 text-white hover:bg-ink-frame">Set trip dates</button>
      <div aria-hidden className="h-16 w-full max-w-md rounded-card border border-dashed border-edge-250 bg-surface" />
    </div>
  )
}
