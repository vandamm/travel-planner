import { useState } from "react"
import { Modal } from "../../components/Modal"
import { useRoom } from "../../data/RoomContext"

export function ShareModal({ onClose }: { onClose: () => void }) {
  const { roomId, presences } = useRoom()
  const [copied, setCopied] = useState(false)

  const tripUrl = typeof window !== "undefined" && roomId ? window.location.origin + "/" + roomId : ""

  const copyUrl = async () => {
    if (tripUrl) {
      try {
        await navigator.clipboard.writeText(tripUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // fallback
      }
    }
  }

  return (
    <Modal label="Share trip" onClose={onClose} className="w-full lg:max-w-md">
      <h2 className="font-serif text-xl font-semibold text-ink">Share trip</h2>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block font-sans text-xs font-medium text-ink-500">Trip URL</label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={tripUrl}
              readOnly
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 rounded-card border border-edge bg-surface px-3 py-2 font-mono text-sm text-ink"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="rounded-card border border-edge-300 bg-white px-3 py-2 font-sans text-sm font-medium text-ink-600 hover:bg-surface-chip"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className="block font-sans text-xs font-medium text-ink-500">
            Collaborators ({presences.length})
          </label>
          <div className="mt-2 space-y-2">
            {presences.length === 0 ? (
              <p className="font-sans text-sm text-ink-500">No one else is viewing this trip.</p>
            ) : (
              presences.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center gap-2 rounded-card border border-edge bg-white px-3 py-2"
                >
                  <div
                    className="h-6 w-6 shrink-0 rounded-full border border-edge"
                    style={{ backgroundColor: p.color }}
                    aria-hidden
                  />
                  <span className="font-sans text-sm text-ink">{p.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-card border border-edge-300 bg-white px-4 py-2 font-sans font-medium text-ink-600 hover:bg-surface-chip"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
