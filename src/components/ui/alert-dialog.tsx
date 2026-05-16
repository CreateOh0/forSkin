'use client'

import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { cn } from '@/lib/utils'

function AlertDialog({ children, ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root {...props}>{children}</AlertDialogPrimitive.Root>
}

function AlertDialogTrigger({ children, ...props }: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger {...props}>{children}</AlertDialogPrimitive.Trigger>
}

function AlertDialogPortal({ children, ...props }: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal {...props}>{children}</AlertDialogPrimitive.Portal>
}

function AlertDialogBackdrop({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      className={cn('fixed inset-0 z-50 bg-black/50', className)}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  children,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogBackdrop />
      <AlertDialogPrimitive.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Popup>
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
  )
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogCancel({ className, ...props }: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
