// Sheen Pill Button, adapted from Open Source UI (https://opensourceui.in/components/sheen-pill-button).
// MIT License, Copyright (c) bidyut10, https://github.com/bidyut10/opensourceui/blob/main/LICENSE
//
// Changes from the original: tuned for small (26-28px) pills on a light background. The blurred
// dark "shade veil" is dropped (at this size it reads as grey smudges), the body is solid white
// glass so the layered drop shadow can lift it off the canvas, the light band is a thin sheen,
// and the button lifts on hover and presses on click. Width follows the content; a busy button
// (aria-busy) is not dimmed while disabled.
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

type Props = { children: ReactNode; height?: number } & ComponentPropsWithoutRef<'button'>

export const SheenPillButton = forwardRef<HTMLButtonElement, Props>(
  ({ children, className = '', height = 28, type = 'button', style, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`sheen-pill group relative inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full outline-none ${className}`}
      style={{ height, ...style }}
      {...props}
    >
      {/* sheen: a soft diagonal light band across the upper half, brightening on hover */}
      <span aria-hidden className="sheen-pill-band pointer-events-none absolute inset-0 rounded-full" />
      <span className="relative flex h-full w-full items-center justify-center gap-1.5 px-3 text-body-mini-medium whitespace-nowrap text-text-primary">
        {children}
      </span>
    </button>
  ),
)
SheenPillButton.displayName = 'SheenPillButton'
