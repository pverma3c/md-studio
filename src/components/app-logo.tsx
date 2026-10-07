import { useId } from "react"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/** The two drawings: design/icons/page.svg and design/icons/page-dark.svg. */
const PALETTES = {
  light: {
    sheet: ["#ffffff", "#eef0f4"],
    // A dark outline so the white page shows on light headers.
    outline: { color: "#000", opacity: 0.18 },
    fold: ["#d6dae3", "#d6dae3"],
    heading: "#23262f",
    line: "#c8ccd5",
    badge: ["#4b8bff", "#1d4ed8"],
  },
  dark: {
    sheet: ["#434957", "#2e323c"],
    // A light rim so the slate page holds its edge on dark headers.
    outline: { color: "#fff", opacity: 0.2 },
    fold: ["#666d7c", "#525966"],
    heading: "#eceef3",
    line: "#7e8594",
    badge: ["#5b97ff", "#2459e6"],
  },
} as const

/**
 * The app icon redrawn for small sizes: no drop shadow, and a slightly
 * stronger outline so the page edge shows against the header. Follows the
 * app's light/dark theme.
 */
export function AppLogo({ className }: { className?: string }) {
  const p = PALETTES[useTheme().resolvedTheme]
  // useId() contains characters like ":" or "«»" that break url(#…) references.
  const id = `logo${useId().replace(/[^\w-]/g, "")}`
  const sheet = `${id}-sheet`
  const fold = `${id}-fold`
  const badge = `${id}-badge`
  return (
    <svg
      viewBox="234 120 580 784"
      className={cn("h-6 w-auto shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={sheet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sheet[0]} />
          <stop offset="1" stopColor={p.sheet[1]} />
        </linearGradient>
        <linearGradient id={fold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.fold[0]} />
          <stop offset="1" stopColor={p.fold[1]} />
        </linearGradient>
        <linearGradient id={badge} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.badge[0]} />
          <stop offset="1" stopColor={p.badge[1]} />
        </linearGradient>
      </defs>
      <path
        d="M274 136 H648 L798 286 V864 Q798 888 774 888 H274 Q250 888 250 864 V160 Q250 136 274 136 Z"
        fill={`url(#${sheet})`}
        stroke={p.outline.color}
        strokeOpacity={p.outline.opacity}
        strokeWidth="14"
      />
      <path d="M648 136 V262 Q648 286 672 286 H798 Z" fill={`url(#${fold})`} />
      <rect x="318" y="348" width="250" height="42" rx="10" fill={p.heading} />
      <rect x="318" y="430" width="400" height="26" rx="13" fill={p.line} />
      <rect
        x="300"
        y="590"
        width="436"
        height="216"
        rx="44"
        fill={`url(#${badge})`}
      />
      <path
        d="M378 744 V664 L434 726 L490 664 V744"
        fill="none"
        stroke="#fff"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M600 660 V712"
        stroke="#fff"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <path
        d="M562 706 L600 756 L638 706 Z"
        fill="#fff"
        stroke="#fff"
        strokeWidth="12"
        strokeLinejoin="round"
      />
    </svg>
  )
}
