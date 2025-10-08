import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function DropdownMenu({ children, className = '' }) {
  return <div className={`inline-block relative ${className}`}>{children}</div>
}

export function DropdownMenuTrigger({ children }) {
  return <>{children}</>
}

export function DropdownMenuContent({ children, className = '', align = 'start' }) {
  const ref = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const content = (
    <div ref={ref} className={`absolute cozy border rounded p-2 shadow-md ${className}`} style={{ minWidth: 160, zIndex: 100000, pointerEvents: 'auto' }}>
      {children}
    </div>
  )

  if (!mounted) return null
  return createPortal(content, document.body)
}

export function DropdownMenuItem({ children, ...props }) {
  return (
    <div {...props} className="px-2 py-2 hover:bg-white/6 dark:hover:bg-white/6 cursor-pointer text-sm">
      {children}
    </div>
  )
}

export default DropdownMenu
