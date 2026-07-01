// Manage the trip's cities (name + color). Cities color-code the days they
// cover via accommodation/override resolution (see `cityResolution.ts`). All
// edits route through the shared city mutators.

import { useState, type FormEvent } from 'react'
import { addCity, listCities, removeCity, updateCity } from '../../data/doc'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'
import { randomCityColor } from './colors'

export function CityManager() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const cities = listCities(doc)

  const [name, setName] = useState('')
  // Default to a random palette colour not already used, re-rolled after each add.
  const [color, setColor] = useState(() => randomCityColor(cities.map((c) => c.color)))

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    addCity(doc, { name: trimmed, color })
    setName('')
    setColor(randomCityColor([...cities.map((c) => c.color), color]))
  }

  return (
    <section
      aria-labelledby="cities-heading"
      className="flex flex-col gap-3 rounded-frame border border-edge bg-white p-4"
    >
      <h2 id="cities-heading" className="font-serif text-lg font-semibold text-ink">
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
                className="h-8 w-10 cursor-pointer rounded-card border border-edge"
              />
              <input
                type="text"
                aria-label={`Name for ${c.name}`}
                value={c.name}
                onChange={(e) => updateCity(doc, c.id, { name: e.target.value })}
                className="flex-1 rounded-card border border-edge px-2 py-1 text-ink"
              />
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => removeCity(doc, c.id)}
                className="rounded-card px-2 py-1 text-sm text-ink-500 hover:bg-surface-chip hover:text-city-vermilion"
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
          className="h-8 w-10 cursor-pointer rounded-card border border-edge"
        />
        <input
          type="text"
          aria-label="New city name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a city…"
          className="flex-1 rounded-card border border-edge px-2 py-1 text-ink"
        />
        <button
          type="submit"
          className="rounded-card bg-ink px-3 py-1 text-sm font-medium text-white hover:bg-ink-frame"
        >
          Add city
        </button>
      </form>
    </section>
  )
}
