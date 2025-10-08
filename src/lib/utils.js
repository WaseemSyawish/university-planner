// Minimal utility helpers used by vendorized Mina components
// Export a `cn` helper (classNames) compatible with how the components call it.
export function cn(...inputs) {
  return inputs
    .flatMap((i) => {
      if (!i) return []
      if (typeof i === 'string') return [i]
      if (Array.isArray(i)) return i
      if (typeof i === 'object') {
        return Object.entries(i).filter(([, v]) => !!v).map(([k]) => k)
      }
      return [String(i)]
    })
    .filter(Boolean)
    .join(' ')
}

export default { cn }
