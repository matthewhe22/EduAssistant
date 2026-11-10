/**
 * Looks for the PowerPoint export. Colours are hex without the leading #. Every theme keeps
 * body text at WCAG AA contrast or better on its background, and white text on `accent` and
 * `accentDark` (table headers, title slide).
 */
export interface DeckTheme {
  id: string;
  label: string;
  /** One line for the picker. */
  hint: string;
  font: string;
  /** Body text, softer text, captions. */
  ink: string;
  soft: string;
  muted: string;
  /** Slide background, panel background and panel borders. */
  background: string;
  paper: string;
  line: string;
  /** Tags, table headers and the footer bar. */
  accent: string;
  /** Headings and the title slide background. */
  accentDark: string;
  /** Learning intention box and picture placeholders. */
  accentTint: string;
  /** Heading bar, question boxes and side panels. */
  highlight: string;
  highlightTint: string;
  /** Small text on the title slide. */
  titleMeta: string;
}

export const THEMES = [
  {
    id: "eucalypt",
    label: "Eucalypt",
    hint: "Lessonroo green and wattle gold",
    font: "Calibri",
    ink: "17202A",
    soft: "3D4852",
    muted: "55606B",
    background: "FFFFFF",
    paper: "FBFBF8",
    line: "C9CDC4",
    accent: "1E5A43",
    accentDark: "123B2B",
    accentTint: "E6F0EA",
    highlight: "F2B53A",
    highlightTint: "FDF1D8",
    titleMeta: "DCE8E1",
  },
  {
    id: "ocean",
    label: "Ocean",
    hint: "Deep blue with coral",
    font: "Calibri",
    ink: "14212B",
    soft: "394B59",
    muted: "52616D",
    background: "FFFFFF",
    paper: "F7FAFC",
    line: "C5D3DD",
    accent: "1D5B85",
    accentDark: "0F3653",
    accentTint: "E2EEF6",
    highlight: "F08A5D",
    highlightTint: "FDEBE2",
    titleMeta: "D3E4F0",
  },
  {
    id: "outback",
    label: "Outback",
    hint: "Warm ochre and sand",
    font: "Calibri",
    ink: "2A1A12",
    soft: "4E3A2E",
    muted: "6A5547",
    background: "FFFDF8",
    paper: "FBF4E8",
    line: "DCCBB4",
    accent: "9A3F22",
    accentDark: "5A2413",
    accentTint: "F6E5DA",
    highlight: "E3A23B",
    highlightTint: "FBEED3",
    titleMeta: "F1DCCD",
  },
  {
    id: "playful",
    label: "Playful",
    hint: "Purple and orange, rounded font for younger students",
    font: "Century Gothic",
    ink: "1F1A2B",
    soft: "433A57",
    muted: "5C536F",
    background: "FFFFFF",
    paper: "FAF8FD",
    line: "D6CEE6",
    accent: "5E3F8C",
    accentDark: "3A2559",
    accentTint: "EEE8F7",
    highlight: "FF8A4C",
    highlightTint: "FFEADD",
    titleMeta: "E2D8F2",
  },
  {
    id: "contrast",
    label: "High contrast",
    hint: "Black on white with yellow, for low vision or bright rooms",
    font: "Arial",
    ink: "000000",
    soft: "1A1A1A",
    muted: "333333",
    background: "FFFFFF",
    paper: "FFFFFF",
    line: "000000",
    accent: "000000",
    accentDark: "000000",
    accentTint: "F2F2F2",
    highlight: "FFD200",
    highlightTint: "FFF5BF",
    titleMeta: "FFFFFF",
  },
] as const satisfies readonly DeckTheme[];

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];
export const DEFAULT_THEME: ThemeId = "eucalypt";

export function themeById(id: string | null | undefined): DeckTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
