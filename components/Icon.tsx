/** Inline stroke icon (decorative). */
export function Icon({ d, size = 20, className = "", strokeWidth = 2 }: { d: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  logo: "M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM8 7h6",
  chevronDown: "m6 9 6 6 6-6",
  back: "m15 18-6-6 6-6",
  plus: "M12 5v14M5 12h14",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  settings: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  check: "M5 12.5 10 17 19 7",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  pencil: "M4 20h4L19 9l-4-4L4 16z",
  print: "M7 9V3h10v6M7 18H4v-7h16v7h-3M7 14h10v7H7z",
  up: "M7 10v11H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 5h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.1 21H7",
  down: "M17 14V3h3v11zM17 14l-4 7a2 2 0 0 1-3-2l1-5H5.5a2 2 0 0 1-2-2.4l1.4-7A2 2 0 0 1 6.9 3H17",
  warning: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};
