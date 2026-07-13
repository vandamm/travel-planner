// The shared shell for every editor modal (CardEditor, AccommodationEditor,
// TripModal, CityModal). Encodes the ink-scrim backdrop, backdrop-click + Escape
// close, and the `role=dialog`/`aria-modal`/`aria-label` contract — so no
// per-modal drift. Extracted from the Phase-1 CardEditor shell.
//
// Responsive (Phase 3): base (mobile) classes make it a full-screen slide-up
// sheet; `lg:` classes restore the Phase-2 centered scrim card. The board uses
// the 640px / Tailwind `sm` board breakpoint; this sheet↔scrim switch is pure
// CSS — no `useViewport` branch, no SSR/hydration mismatch.

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { pushEscapeHandler } from './escapeStack'

export interface ModalProps {
  /** Accessible name for the dialog. */
  label: string
  onClose: () => void
  children: ReactNode
  /** Extra classes for the card (layout/width); merged after the shell base. */
  className?: string
}

export function Modal({ label, onClose, children, className = '' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape close goes through the shared stack so only the top-most overlay
  // reacts (a picker Popover open over this modal wins Escape, not this modal).
  useEffect(() => pushEscapeHandler(onClose), [onClose])

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => opener?.focus()
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-10 flex bg-ink/40 lg:items-center lg:justify-center lg:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`h-full w-full max-h-full animate-sheet-in overflow-y-auto rounded-none bg-white p-6 shadow-xl motion-reduce:animate-none lg:h-auto lg:animate-none lg:rounded-frame lg:border lg:border-ink-frame ${className}`}
      >
        {/* Mobile-only sheet header: a back/close affordance (desktop uses the
            scrim backdrop-click + Escape, so it is hidden at lg:).
            ponytail: we add only the ‹ close control and keep each editor's
            in-body <h2> title + its existing bottom actions — folding actions
            into this header bar is deferred polish, not needed to ship mobile. */}
        <div className="sticky top-0 -mx-6 -mt-6 mb-2 flex items-center border-b border-edge bg-white px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center text-2xl leading-none text-ink-600"
          >
            ‹
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
