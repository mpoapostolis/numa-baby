import { useEffect } from "react"
import { Toaster as Sonner, toast as sonnerToast, type ToasterProps } from "sonner"
import { attachToaster, detachToaster } from "@/lib/toast"

// The theme arrives as a prop from whoever renders this (the app knows its
// own night mode); the icon map shadcn ships went unused — every toast in
// the app is a plain message with, at most, an Undo.
const Toaster = ({ ...props }: ToasterProps) => {
  useEffect(() => {
    attachToaster((message, options) => {
      sonnerToast(message, options)
    })
    return detachToaster
  }, [])

  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
