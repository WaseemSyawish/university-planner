import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const PopoverContext = createContext(null)

export function Popover({ children, className = '' }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const portalIdRef = useRef(null)

  useEffect(() => {
    function updateRect() {
      if (ref.current) setAnchorRect(ref.current.getBoundingClientRect())
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    const ro = new ResizeObserver(updateRect)
    if (ref.current) ro.observe(ref.current)

    // close on outside click
    function onDoc(e) {
      const target = e.target
      const clickedInTrigger = ref.current && ref.current.contains(target)
      // treat clicks inside any portal (data-portal-id) as inside clicks so popovers don't close
      const clickedInAnyPortal = typeof target.closest === 'function' && !!target.closest('[data-portal-id]')
      // if neither, close the popover
      if (!clickedInTrigger && !clickedInAnyPortal) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
      if (ref.current) ro.disconnect()
      document.removeEventListener('mousedown', onDoc)
    }
  }, [])

  return (
    <PopoverContext.Provider value={{ open, setOpen, ref, anchorRect, portalIdRef }}>
      <div ref={ref} className={`relative inline-block ${className}`}>{children}</div>
    </PopoverContext.Provider>
  )
}

export function PopoverTrigger({ children, asChild = false }) {
  const ctx = useContext(PopoverContext)
  if (!ctx) return null

  // If asChild is true, clone the child and attach toggle props
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        e && typeof e.stopPropagation === 'function' && e.stopPropagation()
        ctx.setOpen(!ctx.open)
      },
      // ensure triggers don't submit forms
      type: children.props?.type || 'button',
    })
  }

  return (
    <button type="button" onClick={() => ctx.setOpen(!ctx.open)}>
      {children}
    </button>
  )
}

export function PopoverContent({ children, className = '', align = 'start', style = {} }) {
  const ctx = useContext(PopoverContext)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!ctx || !mounted || !ctx.open) return null

  const rect = ctx.anchorRect || { top: 0, left: 0, width: 160, height: 36 }
  const top = rect.bottom + window.scrollY + 6
  const left = rect.left + window.scrollX
  const minWidth = rect.width

  // Minimal wrapper - styling should be provided by children to avoid nested boxes
  // ensure we have a portal id so outside-click handlers can detect clicks inside this portal
  if (!ctx.portalIdRef) ctx.portalIdRef = { current: null }
  if (!ctx.portalIdRef.current) ctx.portalIdRef.current = 'popover-portal-' + Math.random().toString(36).slice(2, 9)

  const content = (
    <div
      data-portal-id={ctx.portalIdRef.current}
      className={`absolute ${className}`}
      style={{ position: 'absolute', top: top + 'px', left: left + 'px', minWidth: minWidth + 'px', zIndex: 100000, pointerEvents: 'auto', ...style }}
    >
      {children}
    </div>
  )

  return createPortal(content, document.body)
}

// Hook to access popover programmatically
export function usePopover() {
  return useContext(PopoverContext)
}

export default Popover
