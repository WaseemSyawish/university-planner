declare module '*.css'
declare module '*.scss'

declare module 'mina-scheduler'

// allow importing vendorized scheduler components without detailed types
declare module '@/components/schedule/*'
declare module '@/providers/*'

// UI shims
declare module '@/components/ui/*'

// generic
declare const __DEV__: boolean

export {}
declare module '@/components/ui/*'
declare module '@/components/schedule/*'
declare module '@/providers/*'
declare module 'mina-scheduler'
declare module 'lucide-react'
declare module '*.css'
declare module '*.png'

interface Window {
  __NEXT_DATA__?: any
}
