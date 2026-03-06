'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  /** Optional title rendered in the header bar */
  title?:     React.ReactNode;
  /** Called when the user requests to close (backdrop click, ESC, ✕ button) */
  onClose:    () => void;
  children:   React.ReactNode;
  /** Extra Tailwind classes applied to the modal panel (e.g. max-w-lg) */
  className?: string;
}

/**
 * Generic modal overlay.
 *
 * - Rendered into `document.body` via a React portal so it sits on top of
 *   everything regardless of stacking context.
 * - Backdrop click closes the modal.
 * - ESC key closes the modal.
 * - Scroll-locks the body while open.
 */
export default function Modal({ title, onClose, children, className = '' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const content = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={[
          'relative z-10 w-full max-w-md max-h-[85vh] flex flex-col',
          'rounded-xl border border-gray-700 bg-gray-950 shadow-2xl',
          'overflow-hidden',
          className,
        ].join(' ')}
        // Prevent backdrop click from firing when clicking inside the panel
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title != null) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="text-sm font-semibold text-white">{title}</div>
            <button
              className="text-gray-600 hover:text-gray-300 transition text-lg leading-none ml-4"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-4">
          {children}
        </div>
      </div>
    </div>
  );

  // Portal into body so z-index is authoritative
  if (typeof document === 'undefined') return null; // SSR guard
  return createPortal(content, document.body);
}
