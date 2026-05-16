'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

function Dialog({ children, ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>
}

function DialogTrigger({ children, ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger {...props}>{children}</DialogPrimitive.Trigger>
}

function DialogPortal({ children, ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal {...props}>{children}</DialogPrimitive.Portal>
}

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn('fixed inset-0 z-50 bg-black/50', className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function DialogClose({ className, ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close className={cn(className)} {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
