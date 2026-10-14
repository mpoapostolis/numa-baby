// One door to the toast library, so the library itself can arrive late.
//
// sonner was a tenth of the boot bundle, parsed on every open for a message
// nobody sees until the first tap. Now the Toaster (and sonner with it) loads
// in its own chunk and attaches here once it is on screen; anything toasted
// before that moment waits in line and shows the instant it is.

export type ToastOptions = {
  duration?: number;
  description?: string;
  action?: { label: string; onClick: () => void };
  /** The toast timed out, or was swiped or closed — its Undo is gone. */
  onAutoClose?: () => void;
  onDismiss?: () => void;
};

type ToastFn = (message: string, options?: ToastOptions) => void;

let impl: ToastFn | null = null;
const queue: Array<[string, ToastOptions | undefined]> = [];

export function toast(message: string, options?: ToastOptions) {
  if (impl) impl(message, options);
  else queue.push([message, options]);
}

/** Called by the Toaster when it mounts; replays whatever queued meanwhile. */
export function attachToaster(fn: ToastFn) {
  impl = fn;
  for (const [message, options] of queue.splice(0)) fn(message, options);
}

export function detachToaster() {
  impl = null;
}

/**
 * A tap on a toast is not a tap outside an open dialog. Toasts can be tapped
 * over a dialog (an Undo over the sheet that just saved), and a dialog that
 * took that tap as "outside" would close under the parent's thumb.
 */
export function isToastTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("[data-sonner-toaster]") !== null;
}

