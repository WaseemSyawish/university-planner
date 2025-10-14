"use client";
import React from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '@/providers/modal-context'
import { X } from 'lucide-react'

export default function CustomModal({ title, children }) {
  const { setClose } = useModal();

  if (typeof window === 'undefined') return null

  return createPortal(
  <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        // Use a theme-aware overlay: dark mode uses a subtle light overlay (white/5) so
        // the modal content doesn't get an extra heavy black wash on top of a dark background.
  className="absolute inset-0 bg-black/40 dark:bg-white/5 backdrop-blur-md"
        onClick={() => setClose()}
      />

  <div className="relative w-full max-w-[520px] cozy rounded-md shadow-2xl ring-1 ring-white/6 overflow-visible max-h-[90vh] bg-white dark:bg-slate-900 dark:ring-white/6 mx-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-semibold leading-tight text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            aria-label="Close"
            className="ml-4 p-2 rounded-full text-slate-500 hover:bg-white/6 dark:text-slate-300 dark:hover:bg-white/6"
            onClick={() => setClose()}
          >
            <X size={16} />
          </button>
        </div>

        {/* no separator here - content should sit directly under title like Mina */}

        <div className="text-slate-700 dark:text-slate-300">{children}</div>

        {/* modal footer intentionally omitted — modal content should render its own actions */}
      </div>
    </div>,
    document.body
  )
}

