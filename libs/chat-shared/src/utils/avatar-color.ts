/** A background/foreground colour pair for an initials avatar badge. */
export interface AvatarColorEntry {
  /** CSS hex colour for the badge background. */
  background: string;
  /** CSS hex colour for the initials text. */
  foreground: string;
}

/** Fixed WCAG-AA-compliant palette (≥4.5:1 contrast ratio for each pair). */
const PALETTE: readonly AvatarColorEntry[] = [
  { background: '#0d7377', foreground: '#ffffff' }, // teal
  { background: '#6b3fa0', foreground: '#ffffff' }, // violet
  { background: '#b45309', foreground: '#ffffff' }, // amber
  { background: '#be185d', foreground: '#ffffff' }, // rose
  { background: '#15803d', foreground: '#ffffff' }, // emerald
  { background: '#0369a1', foreground: '#ffffff' }, // sky
  { background: '#c2410c', foreground: '#ffffff' }, // orange
  { background: '#3730a3', foreground: '#ffffff' }, // indigo
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
