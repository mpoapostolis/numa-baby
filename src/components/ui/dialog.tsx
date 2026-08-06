import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
}: DialogContextValue & { children: React.ReactNode }) {
  return <DialogContext value={{ open, onOpenChange }}>{children}</DialogContext>;
}

type DialogContentProps = Omit<React.ComponentPropsWithoutRef<"dialog">, "onClose"> & {
  showCloseButton?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const context = React.useContext(DialogContext);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const restoredFocus = React.useRef(false);

  if (!context) throw new Error("DialogContent must be used inside Dialog");

  const restoreFocus = React.useEffectEvent(() => {
    if (restoredFocus.current) return;
    restoredFocus.current = true;
    const event = new Event("closeAutoFocus", { cancelable: true });
    onCloseAutoFocus?.(event);
  });

  const focusOnOpen = React.useEffectEvent((dialog: HTMLDialogElement) => {
    const event = new Event("openAutoFocus", { cancelable: true });
    onOpenAutoFocus?.(event);

    if (!event.defaultPrevented) {
      window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>("[autofocus], button, input, textarea, select")?.focus();
      });
    }
  });

  const close = React.useEffectEvent(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    restoreFocus();
    context.onOpenChange?.(false);
  });

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !context.open || dialog.open) return;

    restoredFocus.current = false;
    dialog.showModal();
    focusOnOpen(dialog);

    return () => {
      if (dialog.open) dialog.close();
      restoreFocus();
    };
  }, [context.open]);

  return (
    <dialog
      ref={dialogRef}
      className={cn("ui-dialog-content", className)}
      data-state={context.open ? "open" : "closed"}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) close();
      }}
      {...props}
    >
      {children}
      {showCloseButton && (
        <button className="ui-dialog-close" type="button" aria-label="Close" onClick={close}>
          <X size={18} />
        </button>
      )}
    </dialog>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("ui-dialog-header", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("ui-dialog-footer", className)} {...props} />;
}

export function DialogTitle({ className, id = "dialog-title", ...props }: React.ComponentProps<"h2">) {
  return <h2 id={id} className={cn("ui-dialog-title", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("ui-dialog-description", className)} {...props} />;
}
