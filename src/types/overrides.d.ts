declare module '@/components/ui/button' {
  import * as React from 'react'
  export const Button: React.ComponentType<any>
  export default Button
}

declare module '@/components/ui/badge' {
  import * as React from 'react'
  export const Badge: React.ComponentType<any>
  export default Badge
}

declare module '@/components/ui/custom-modal' {
  import * as React from 'react'
  const CustomModal: React.ComponentType<any>
  export default CustomModal
}

declare module '@/components/schedule/*' {
  import * as React from 'react'
  const Component: React.ComponentType<any>
  export default Component
}

declare module '@/providers/*' {
  import * as React from 'react'
  const anything: any
  export default anything
}
