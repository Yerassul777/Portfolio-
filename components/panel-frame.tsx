"use client"

import type { ReactNode, RefObject } from "react"
import { X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * - "sheet": the website. Slides in from the right over a dimmed page.
 * - "screen": the installed app. Fills the window next to the app's
 *   navigation (above the tab bar on a phone, right of the rail on an iPad
 *   or desktop): no overlay, no slide, the navigation stays usable,
 *   switching tabs is instant.
 */
export type PanelVariant = "sheet" | "screen"

/** Shared by every panel so both variants behave the same way. */
export function panelContentProps(variant: PanelVariant, returnFocusRef: RefObject<HTMLElement | null>) {
  return {
    className: cn(
      "flex flex-col overflow-hidden border-gray-800 bg-[#0d1210] p-0 [&>button]:hidden",
      variant === "sheet"
        ? "w-full sm:w-[90vw] sm:max-w-[600px] md:w-[600px]"
        : "inset-y-auto left-[var(--app-rail-width)] right-0 top-[var(--app-titlebar-height)] bottom-[var(--app-tabbar-height)] h-auto w-auto max-w-none border-0 sm:max-w-none data-[state=closed]:animate-none data-[state=open]:animate-none"
    ),
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      returnFocusRef.current?.focus()
    },
    // A tap on the tab bar is "outside" the screen; the tab bar decides what opens.
    onInteractOutside: variant === "screen" ? (event: Event) => event.preventDefault() : undefined,
    // A tab switch is not a dialog opening: focus stays where the finger was,
    // instead of a focus ring jumping onto the screen's first control.
    onOpenAutoFocus: variant === "screen" ? (event: Event) => event.preventDefault() : undefined,
  }
}

interface PanelFrameProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: PanelVariant
  returnFocusRef: RefObject<HTMLElement | null>
  icon: LucideIcon
  title: string
  description: ReactNode
  closeLabel: string
  /** Under the title, e.g. tabs. */
  headerExtra?: ReactNode
  /** Right of the title, e.g. the profile button. */
  headerAction?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function PanelFrame({
  open,
  onOpenChange,
  variant,
  returnFocusRef,
  icon: Icon,
  title,
  description,
  closeLabel,
  headerExtra,
  headerAction,
  children,
  footer,
}: PanelFrameProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={variant === "sheet"}>
      <SheetContent side="right" {...panelContentProps(variant, returnFocusRef)}>
        <SheetHeader className="shrink-0 border-b border-gray-800 bg-[#0a0f0d] px-6 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-white">
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600">
                <Icon className="h-4 w-4 text-white" />
              </span>
              {title}
            </SheetTitle>
            <div className="flex items-center gap-1">
            {headerAction}
            {variant === "sheet" && (
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label={closeLabel} className="size-11 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white">
                  <X className="h-5 w-5" />
                </Button>
              </SheetClose>
            )}
            </div>
          </div>
          <SheetDescription className="mt-1 text-sm text-gray-400">{description}</SheetDescription>
          {headerExtra}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* overflow-x: clip — a screen never becomes wider than the phone and slides sideways. */}
          <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-clip">{children}</div>
        </div>
        {footer && (
          <div className="shrink-0 border-t border-gray-800 bg-[#0a0f0d] px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  )
}
