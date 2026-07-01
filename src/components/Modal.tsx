// The shared scrim shell for every editor modal (CardEditor, AccommodationEditor,
// TripModal, CityModal). Encodes the ink-scrim backdrop, centered card,
// backdrop-click + Escape close, and the `role=dialog`/`aria-modal`/`aria-label`
// contract — so no per-modal drift. Extracted from the Phase-1 CardEditor shell.

import { useEffect, type ReactNode } from 'react'

export interface ModalProps {
  /** Accessible name for the dialog. */
  label: string
  onClose: () => void
  children: ReactNode
  /** Extra classes for the card (layout/width); merged after the shell base. */
  className?: string
}

export function Modal({ label, onClose, children, className = '' }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-frame border border-ink-frame bg-white p-6 shadow-xl ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
