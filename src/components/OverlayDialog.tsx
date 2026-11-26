"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

let modalCount = 0;
let previousOverflow = "";

/** Native modal semantics keep focus inside the sheet and the page behind it inert. */
export function OverlayDialog({ open, onClose, labelledBy, children, className = "", id }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Close before Next's Activity hides a preserved route, so a native modal
  // cannot remain in the top layer after its page becomes inactive.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (modalCount++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    return () => {
      dialog.close();
      if (--modalCount === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  // A caller may use `flex`; unmounting prevents that utility from overriding
  // the browser's closed-dialog display rule.
  if (!open) return null;

  return (
    <dialog
      id={id}
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={(event) => { if (open && !event.currentTarget.open) onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
      className={`fixed overflow-hidden border-0 bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] ${className}`}
    >
      {children}
    </dialog>
  );
}
