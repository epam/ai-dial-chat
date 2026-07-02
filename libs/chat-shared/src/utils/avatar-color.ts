/** A background/foreground colour pair for an initials avatar badge. */
export interface AvatarColorEntry {
  /** CSS hex colour for the badge background. */
  background: string;
  /** CSS hex colour for the initials text. */
  foreground: string;
}

/** Fixed WCAG-AA-compliant palette (≥4.5:1 contrast ratio for each pair). */
const PALETTE: readonly AvatarColorEntry[] = [
  { background: '#cde8e5', foreground: '#0d6e72' }, // teal
  { background: '#e2d9f3', foreground: '#5b21b6' }, // violet
  { background: '#fde8c8', foreground: '#92400e' }, // amber
  { background: '#fce7f3', foreground: '#9d174d' }, // rose
  { background: '#d1f0dc', foreground: '#065f46' }, // emerald
  { background: '#d6edf9', foreground: '#075985' }, // sky
  { background: '#fde8d8', foreground: '#9a3412' }, // orange
  { background: '#dde3f9', foreground: '#3730a3' }, // indigo
];

/**
 * Deterministically maps a display name to a palette entry using a
 * char-code-sum hash. The same name always returns the same colours.
 */
export const pickAvatarColor = (name: string): AvatarColorEntry => {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return PALETTE[sum % PALETTE.length];
};
