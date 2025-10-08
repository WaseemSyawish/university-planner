import React from 'react'

export function Card({ children, className = '' }) {
  // Use the `.cozy` utility and CSS variables so cards follow dark/light themes
  return <div className={`rounded border cozy p-4 shadow-sm ${className}`}>{children}</div>
}

export default Card
