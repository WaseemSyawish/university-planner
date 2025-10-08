import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

export const Dialog = ({ children, open, onOpenChange }) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>{children}</DialogPrimitive.Root>
);

export const DialogTrigger = ({ children, ...props }) => (
  <DialogPrimitive.Trigger {...props}>{children}</DialogPrimitive.Trigger>
);

export const DialogContent = ({ children, className = '', ...props }) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40" />
    <DialogPrimitive.Content className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`} {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const DialogHeader = ({ children, className = '', ...props }) => (
  <div className={`pb-4 ${className}`} {...props}>{children}</div>
);

export const DialogTitle = ({ children, className = '', ...props }) => (
  <DialogPrimitive.Title className={className} {...props}>{children}</DialogPrimitive.Title>
);

export default Dialog;
