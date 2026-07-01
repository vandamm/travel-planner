// Manage the trip's cities (name + colour) as a scrim pop-over, opened from the
// header's `[◉ Cities]` button. Cities colour-code the days they cover via
// accommodation/override resolution (see `cityResolution.ts`). Every edit writes
// straight through the shared city mutators — live, like every other edit — so
// there is no Save/Cancel: a single ink `Done` (plus backdrop / Escape via the
// shared `Modal`) closes it.

import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { addCity, listCities, removeCity, updateCity } from '../../data/doc'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'
import { randomCityColor } from './colors'

export interface CityModalProps {
  onClose: () => void
}

const sectionLabel = 'text-[10px] font-bold uppercase tracking-[0.06em] text-ink-400'
// A native colour input restyled into a round swatch (the mock's colour dot).
const swatch =
  'shrink-0 cursor-pointer appearance-none rounded-full border border-edge-300 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0'

export function CityModal({ onClose }: CityModalProps) {
  const { doc } = useRoom()
  useDocVersion(doc)
  const cities = listCities(doc)

  const [name, setName] = useState('')
  // Default to a random palette colour not already used, re-rolled after each add.
  const [color, setColor] = useState(() => randomCityColor(cities.map((c) => c.color)))
  const reroll = () => setColor(randomCityColor([...cities.map((c) => c.color), color]))

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    addCity(doc, { name: trimmed, color })
    setName('')
    reroll()
  }

  return (
    <Modal label="Cities & colours" onClose={onClose} className="flex w-full max-w-md flex-col">
      <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Cities &amp; colours</h2>

      {cities.length > 0 && (
        <ul className="flex flex-col gap-2">
          {cities.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-card border border-edge-100 bg-surface px-3 py-2.5"
            >
              <input
                type="color"
                aria-label={`Colour for ${c.name}`}
                value={c.color}
                onChange={(e) => updateCity(doc, c.id, { color: e.target.value })}
                className={`${swatch} h-[14px] w-[14px]`}
              />
              <input
                type="text"
                aria-label={`Name for ${c.name}`}
                value={c.name}
                onChange={(e) => updateCity(doc, c.id, { name: e.target.value })}
                className="flex-1 border-none bg-transparent p-0 font-serif text-[15px] text-ink focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => removeCity(doc, c.id)}
                className="text-lg leading-none text-ink-200 hover:text-city-vermilion"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-dashed border-edge-300 pt-3.5">
        <p className={`${sectionLabel} mb-2`}>Add a city</p>
        <form onSubmit={onAdd} className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <input
              type="color"
              aria-label="New city colour"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={`${swatch} h-[30px] w-[30px]`}
            />
            <button
              type="button"
              aria-label="Pick a different colour"
              onClick={reroll}
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-edge-300 bg-white text-[10px] font-bold leading-none text-ink-500"
            >
              ↻
            </button>
          </div>
          <input
            type="text"
            aria-label="New city name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cinque Terre…"
            className="flex-1 rounded-card border border-edge px-3 py-2 font-serif text-[14px] italic text-ink placeholder:italic placeholder:text-ink-300"
          />
          <button
            type="submit"
            className="rounded-card bg-ink px-4 py-2 font-sans text-[13px] font-semibold text-white hover:bg-ink-frame"
          >
            Add
          </button>
        </form>
        <p className="mt-2.5 font-sans text-[11px] font-medium leading-relaxed text-ink-400">
          A colour is picked for you — click the dot to choose another.
        </p>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-card bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-ink-frame"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
