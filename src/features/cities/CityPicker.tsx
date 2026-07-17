import { Popover } from '../../components/Popover'
import type { City } from '../../data/schema'

export interface CityPickerProps {
  label: string
  value?: string
  resolvedCityId?: string
  cities: City[]
  onChange: (cityId: string | null) => void
  includeAddCity?: boolean
  onAddCity?: () => void
  hint?: string
}

export function CityPicker({
  label,
  value,
  resolvedCityId,
  cities,
  onChange,
  includeAddCity = false,
  onAddCity,
  hint,
}: CityPickerProps) {
  const selectedId = value ?? resolvedCityId
  const selected = selectedId ? cities.find((city) => city.id === selectedId) : undefined
  return (
    <Popover
      label={label}
      triggerAriaLabel={label}
      trigger={
        <span className="flex items-center gap-1 font-serif text-inherit">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selected?.color ?? '#c2bba8' }} />
          {selected?.name ?? 'Auto'} ▾
        </span>
      }
      triggerClassName="inline-flex items-center rounded-card border border-edge-350 px-2 py-1 text-sm text-ink-600 hover:bg-surface-chip"
    >
      {(close) => (
        <div className="flex min-w-48 flex-col gap-1">
          <p className="px-2 pb-1 text-xs text-ink-500">Set this day&apos;s city</p>
          <button type="button" className="rounded-card px-2 py-2 text-left text-sm hover:bg-surface-chip" onClick={() => { onChange(null); close() }}>
            Auto — from stay {value === undefined ? '✓' : ''}
          </button>
          {cities.map((city) => (
            <button key={city.id} type="button" className="flex items-center gap-2 rounded-card px-2 py-2 text-left text-sm hover:bg-surface-chip" onClick={() => { onChange(city.id); close() }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: city.color }} />
              {city.name} {selectedId === city.id ? '✓' : ''}
            </button>
          ))}
          {hint && <p className="px-2 pt-1 text-xs text-ink-500">{hint}</p>}
          {includeAddCity && <button type="button" className="button-label mt-1 text-left text-city-vermilion" onClick={() => { onAddCity?.(); close() }}>+ Add city</button>}
        </div>
      )}
    </Popover>
  )
}
