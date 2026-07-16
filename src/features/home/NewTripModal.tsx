import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { slugFromName } from '../../data/slug'
import { TRIP_COLORS } from './yearCalendar'

const workerBase = () => (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')

export function NewTripModal({
  onClose,
  startDate: initialStartDate,
  endDate: initialEndDate,
}: {
  onClose: () => void
  startDate?: string
  endDate?: string
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [startDate, setStartDate] = useState(initialStartDate ?? '')
  const [endDate, setEndDate] = useState(initialEndDate ?? initialStartDate ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function createTrip(event: FormEvent) {
    event.preventDefault()
    const title = name.trim()
    if (endDate < startDate) {
      setError('End date must be on or after start date')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${workerBase()}/api/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          room: slug,
          title,
          startDate,
          endDate,
          color: TRIP_COLORS[Math.floor(Math.random() * TRIP_COLORS.length)],
        }),
      })
      const body = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !body.id) throw new Error(body.error || 'Could not create trip')
      location.assign(`/${body.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create trip')
      setSaving(false)
    }
  }

  return (
    <Modal label="Plan new trip" onClose={onClose} className="w-full sm:max-w-md">
      <form onSubmit={createTrip} className="space-y-4">
        <div className="hidden sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-city-vermilion">New journey</p>
          <h2 className="font-serif text-3xl font-semibold">Plan new trip</h2>
        </div>
        <label className="block text-sm font-semibold">
          Trip name
          <input
            autoFocus
            required
            value={name}
            onChange={(event) => {
              const value = event.target.value
              setName(value)
              if (!slugEdited) setSlug(slugFromName(value))
            }}
            placeholder="Japan in spring"
            className="mt-2 w-full rounded-card border border-edge px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Trip slug
          <input
            required
            maxLength={64}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="japan-spring-2027"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true)
              setSlug(event.target.value.toLowerCase())
            }}
            className="mt-2 w-full rounded-card border border-edge px-3 py-2 font-normal"
          />
        </label>
        <fieldset>
          <legend className="sr-only">Trip dates</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0 text-sm font-semibold">
              Start
              <input
                aria-label="Start date"
                required
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full min-w-0 rounded-card border border-edge px-3 py-2 font-normal"
              />
            </label>
            <label className="block min-w-0 text-sm font-semibold">
              End
              <input
                aria-label="End date"
                required
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full min-w-0 rounded-card border border-edge px-3 py-2 font-normal"
              />
            </label>
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm font-semibold text-city-vermilion">{error}</p>}
        <button disabled={saving} className="w-full rounded-card bg-city-vermilion px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? 'Creating…' : 'Create trip'}
        </button>
      </form>
    </Modal>
  )
}
