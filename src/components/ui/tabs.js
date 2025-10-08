import React from 'react'

export function Tabs({ children, value, onValueChange, className = '' }) {
  // Dispatch an init event so TabContent can pick up the initial value
  React.useEffect(() => {
    if (typeof window !== 'undefined' && value != null) {
      const ev = new CustomEvent('tabs:init', { detail: value });
      window.dispatchEvent(ev);
    }
  }, [value]);

  return <div className={className}>{children}</div>
}

export function TabsList({ children, className = '' }) {
  return <div className={className}>{children}</div>
}

export function TabsTrigger({ children, value }) {
  // When clicked, dispatch a custom event so parent can pick it up via onValueChange prop (simple shim)
  function handleClick(e) {
    const ev = new CustomEvent('tabs:change', { detail: value })
    window.dispatchEvent(ev)
  }

  return (
    <button data-value={value} onClick={handleClick} className="px-3 py-1 rounded-md hover:bg-gray-100">
      {children}
    </button>
  )
}

export function TabsContent({ children, value }) {
  const [active, setActive] = React.useState(value ?? null)

  React.useEffect(() => {
    function onChange(e) {
      setActive(e.detail)
    }
    function onInit(e) {
      setActive(e.detail)
    }
    window.addEventListener('tabs:change', onChange)
    window.addEventListener('tabs:init', onInit)
    return () => {
      window.removeEventListener('tabs:change', onChange)
      window.removeEventListener('tabs:init', onInit)
    }
  }, [])

  // Mount/unmount content to allow AnimatePresence inside children to animate
  if (active !== value) return null
  return <div>{children}</div>
}

export default Tabs
