"use client";
import React from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '@/providers/modal-context'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CustomModal({ title, children }) {
  const { setClose } = useModal();

  if (typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setClose()}
      />

  <div className="relative w-full max-w-[520px] cozy rounded-md shadow-2xl ring-1 ring-white\/6 overflow-visible max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-semibold leading-tight">{title}</h2>
          <button
            aria-label="Close"
            className="ml-4 p-2 rounded-full text-slate-500 hover:bg-white\/6"
            onClick={() => setClose()}
          >
            <X size={16} />
          </button>
        </div>

        {/* no separator here - content should sit directly under title like Mina */}

        <div className="px-6 pb-6">{children}</div>

        {/* modal footer intentionally omitted — modal content should render its own actions */}
      </div>
    </div>,
    document.body
  )
}
