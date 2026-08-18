import { type ReactNode } from 'react'

// Simple, consistent stroke-based icons. 24×24 viewBox, currentColor stroke.
// Adding new ones: keep them visually minimal to fit the educational warm style.

const ICONS: Record<string, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 21v-1.5a4 4 0 014-4h4a4 4 0 014 4V21" />
      <path d="M16.5 4.5a3.5 3.5 0 010 7M21 21v-1.5a4 4 0 00-3-3.85" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V6a2 2 0 012-2h13v15.5" />
      <path d="M4 19.5A2.5 2.5 0 016.5 17H19v3H6.5A2.5 2.5 0 014 19.5z" />
      <path d="M8 7.5h7M8 11h7" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.5 12c0-.55-.06-1.09-.16-1.61l1.78-1.39-2-3.46-2.11.81a7.9 7.9 0 00-2.78-1.61L13.85 2.5h-3.7l-.38 2.24a7.9 7.9 0 00-2.78 1.61l-2.11-.81-2 3.46 1.78 1.39c-.1.52-.16 1.06-.16 1.61s.06 1.09.16 1.61l-1.78 1.39 2 3.46 2.11-.81a7.9 7.9 0 002.78 1.61l.38 2.24h3.7l.38-2.24a7.9 7.9 0 002.78-1.61l2.11.81 2-3.46-1.78-1.39c.1-.52.16-1.06.16-1.61z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  graduation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10l10-4 10 4-10 4-10-4z" />
      <path d="M6 12v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4" />
      <path d="M20 11v5" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  ),
  arrowLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
}

interface IconProps {
  name: keyof typeof ICONS
  size?: number
  className?: string
}

export default function Icon({ name, size = 18, className }: IconProps) {
  return (
    <span
      className={`icon${className ? ' ' + className : ''}`}
      style={{ width: size, height: size, display: 'inline-flex' }}
      aria-hidden="true"
    >
      {ICONS[name]}
    </span>
  )
}
