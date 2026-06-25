// Manage the trip's cities (name + color). Cities color-code the days they
// cover via accommodation/override resolution (see `cityResolution.ts`). All
// edits route through the shared city mutators.

import { useState, type FormEvent } from 'react'
import { addCity, listCities, removeCity, updateCity } from '../../data/doc'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'

/** A pleasant default so the color picker never starts on black. */
const DEFAULT_COLOR = '#3b82f6'

export function CityManager() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const cities = listCities(doc)

  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    addCity(doc, { name: trimmed, color })
    setName('')
    setColor(DEFAULT_COLOR)
  }

  return (
    <section
      aria-labelledby="cities-heading"
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="cities-heading" className="text-lg font-semibold text-slate-800">
        Cities
      </h2>

      {cities.length > 0 && (
        <ul className="flex flex-col gap-2">
          {cities.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Colour for ${c.name}`}
                value={c.color}
                onChange={(e) => updateCity(doc, c.id, { color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-300"
              />
              <input
                type="text"
                aria-label={`Name for ${c.name}`}
                value={c.name}
                onChange={(e) => updateCity(doc, c.id, { name: e.target.value })}
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-slate-900"
              />
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => removeCity(doc, c.id)}
                className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="flex items-center gap-2">
        <input
          type="color"
          aria-label="New city colour"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-slate-300"
        />
        <input
          type="text"
          aria-label="New city name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a city…"
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-slate-900"
        />
        <button
          type="submit"
          className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add city
        </button>
      </form>
    </section>
  )
}
