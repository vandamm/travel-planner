// An anchored floating panel for field pop-overs (the §10 date + §11 time
// pickers). A trigger button toggles a `role="dialog"` panel pinned just below
// it via `popoverPosition` (no positioning library — CSS `fixed` + measured
// rects), closing on Escape and outside-click. On the mobile viewport it falls
// back to the shared full-screen `Modal` sheet instead of anchoring — reuse, not
// a second sheet implementation.
//
// `children` is a render-prop so a consumer can `close()` after committing a value. No
// controlled-open / placement props "for later" — add them when a consumer needs one.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { useViewport } from '../features/board/useViewport'
import { popoverPosition } from './popoverPosition'
import { pushEscapeHandler } from './escapeStack'

interface PopoverProps {
  /** Accessible name for the popover dialog. */
  label: string
  /** Content rendered inside the trigger button (e.g. the current field value). */
  trigger: ReactNode
  /** Classes for the trigger button (styles it as a field). */
  triggerClassName?: string
  /** Accessible name for the trigger button, if the content isn't self-describing. */
  triggerAriaLabel?: string
  /** Panel body; `close` dismisses the popover (call it after committing a value). */
  children: (close: () => void) => ReactNode
}

export function Popover({
  label,
  trigger,
  triggerClassName = '',
  triggerAriaLabel,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isMobile = useViewport() === 'mobile'

  const close = () => setOpen(false)

  // Anchored placement (desktop only — mobile uses the Modal sheet). Re-measures
  // on resize/scroll so the panel tracks its trigger.
  useEffect(() => {
    if (!open || isMobile) return
    function place() {
      const t = triggerRef.current?.getBoundingClientRect()
      const p = panelRef.current?.getBoundingClientRect()
      if (!t || !p) return
      setPos(
        popoverPosition(
          t,
          { width: p.width, height: p.height },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      )
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, isMobile])

  // Escape + outside-click close (desktop; the Modal owns these on mobile).
  // Escape routes through the shared stack so it dismisses this panel without
  // also closing the editor Modal behind it.
  useEffect(() => {
    if (!open || isMobile) return
    const removeEscapeHandler = pushEscapeHandler(close)
    function onPointerDown(e: Event) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      removeEscapeHandler()
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open, isMobile])

  // Move focus into the panel on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    panelRef.current?.focus()
    return () => trigger?.focus()
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerAriaLabel}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open &&
        (isMobile ? (
          <Modal label={label} onClose={close}>
            {children(close)}
          </Modal>
        ) : (
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            className="fixed z-20 animate-popover-in rounded-frame border border-ink-frame bg-white p-3 shadow-[0_18px_44px_-28px_rgba(38,35,29,0.40)] outline-none motion-reduce:animate-none"
            style={{
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              // Hide until measured so it never flashes at the wrong spot.
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {children(close)}
          </div>
        ))}
    </>
  )
}
