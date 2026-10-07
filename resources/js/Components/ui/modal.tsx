import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}

const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

/** Accessible dialog on the native <dialog> element (focus trap and Escape for free). */
export function Modal({ open, onClose, title, description, footer, size = "md", children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        widths[size],
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </header>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
    </dialog>
  );
}
