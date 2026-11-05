/**
 * Lessonroo logo: a kangaroo footprint ("roo") beside a pencil ("lesson"), in green and gold.
 * Source design: the "Lessonroo Logo" canvas, option A4.
 */

type MarkColours = { foot: string; pencil: string; eraser: string; band: string; wood: string; tip: string };

const ON_LIGHT: MarkColours = { foot: "#1E5A43", pencil: "#E0A32E", eraser: "#E98E86", band: "#1E5A43", wood: "#F2D9A8", tip: "#17202A" };
const ON_GREEN: MarkColours = { foot: "#FBFBF8", pencil: "#F2B53A", eraser: "#F4A8A0", band: "#FBFBF8", wood: "#F6E3BD", tip: "#1E5A43" };

/** The footprint-and-pencil symbol on its own (96×96 artwork). */
export function LogoMark({ size = 40, onGreen = false, title }: { size?: number; onGreen?: boolean; title?: string }) {
  const c = onGreen ? ON_GREEN : ON_LIGHT;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <ellipse cx="30" cy="58" rx="10.5" ry="24" transform="rotate(-7 30 58)" fill={c.foot} />
      <circle cx="27" cy="26" r="6" fill={c.foot} />
      <rect x="55" y="14" width="16" height="9" rx="3" fill={c.eraser} />
      <rect x="55" y="22" width="16" height="5" fill={c.band} />
      <rect x="55" y="27" width="16" height="40" fill={c.pencil} />
      <polygon points="55,67 71,67 63,84" fill={c.wood} />
      <polygon points="60,77.5 66,77.5 63,84" fill={c.tip} />
    </svg>
  );
}

/** The app icon: the mark on a green rounded square. */
export function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-euc"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.23) }}
      aria-hidden="true"
    >
      <LogoMark size={Math.round(size * 0.72)} onGreen />
    </span>
  );
}

/** "lesson" + green "roo". `light` is for dark backgrounds. */
export function Wordmark({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`font-display font-bold tracking-[-0.035em] ${light ? "text-paper" : "text-ink"} ${className}`}>
      lesson<span className={light ? "text-wattle" : "text-euc"}>roo</span>
    </span>
  );
}

/** Icon and wordmark side by side, as used in headers. */
export function Logo({ size = 36, textClass = "text-[23px]" }: { size?: number; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoTile size={size} />
      <Wordmark className={textClass} />
    </span>
  );
}
