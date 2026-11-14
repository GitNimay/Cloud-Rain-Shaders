import { useState } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark'

// Icon-only light/dark switch. The theme lives on <html data-theme>; an inline script in
// index.html sets it before first paint (saved choice, else the system setting), so this
// only has to flip it, remember it, and cross-fade the change where the browser can.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const next: Theme = theme === 'dark' ? 'light' : 'dark'

  const toggle = () => {
    const apply = () => {
      document.documentElement.dataset.theme = next
      flushSync(() => setTheme(next)) // the icon must swap inside the transition's snapshot
    }
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Storage blocked (private mode, sandbox): the switch still works for this visit.
    }
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply)
    else apply()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-6 place-items-center rounded-md text-text-secondary outline-none transition-colors hover:bg-fill-tertiary/40 hover:text-text-primary focus-visible:shadow-focus"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5">
        {theme === 'dark' ? (
          // sun (Lucide, ISC license)
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        ) : (
          // moon (Lucide, ISC license)
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        )}
      </svg>
    </button>
  )
}
