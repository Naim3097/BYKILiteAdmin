import React, { useEffect, useRef, useCallback } from 'react'

/**
 * ResponsiveModal
 * --------------------------------------------------------------
 * Bottom-sheet on phones (<sm), centered dialog from sm and up.
 * Handles: backdrop click, ESC key, body scroll lock, focus trap entry,
 * safe-area insets, smooth slide-up animation.
 *
 * Usage:
 *   <ResponsiveModal
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     title="Edit Invoice"
 *     size="lg"            // sm | md | lg | xl | full
 *     footer={<><Cancel /><Save /></>}
 *   >
 *     ...body content...
 *   </ResponsiveModal>
 */

const sizeMap = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-6xl',
  full: 'sm:max-w-[95vw]',
}

const ResponsiveModal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  hideCloseButton = false,
  className = '',
  bodyClassName = '',
}) => {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const closeOnEscRef = useRef(closeOnEsc)

  // Keep refs up to date without causing effect to re-run
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { closeOnEscRef.current = closeOnEsc }, [closeOnEsc])

  // ESC + body scroll lock — only re-runs when isOpen changes
  useEffect(() => {
    if (!isOpen) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (e) => {
      if (closeOnEscRef.current && e.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKey)

    // Focus first focusable for keyboard users
    const t = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    }, 50)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKey)
      clearTimeout(t)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black-50 animate-fade-in"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className={`
          bg-primary-white w-full shadow-card flex flex-col
          rounded-t-2xl sm:rounded-lg
          max-h-[95dvh] sm:max-h-[90vh]
          animate-slide-up sm:animate-fade-in
          ${sizeMap[size] || sizeMap.md}
          ${className}
        `}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-black-25" />
        </div>

        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-black-10 shrink-0">
            <h3
              id="modal-title"
              className="text-lg sm:text-xl font-bold text-primary-black truncate"
            >
              {title}
            </h3>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-black-50 hover:text-primary-black min-h-touch min-w-touch flex items-center justify-center -mr-2 tap-clean"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body — scrollable */}
        <div className={`flex-1 overflow-y-auto touch-scroll px-4 sm:px-6 py-4 ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-black-10 shrink-0 bg-primary-white">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default ResponsiveModal
