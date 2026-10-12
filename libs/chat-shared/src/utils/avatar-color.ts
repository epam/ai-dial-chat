/** A background/foreground colour pair for an initials avatar badge. */
export interface AvatarColorEntry {
  /** CSS colour value for the badge background — a theme token with a hex fallback. */
  background: string;
  /** CSS colour value for the initials text — a theme token with a hex fallback. */
  foreground: string;
}

/*
 * One entry per `--bg-visual-*` token in `tailwind.config.js`, each paired with the
 * matching `--text-visual-*` token so the badge follows the active theme. Contrast is
 * ≥4.5:1 for every pair except brown (4.2:1), which keeps the design-system pairing.
 */
const PALETTE: readonly AvatarColorEntry[] = [
  {
    background: 'var(--bg-visual-green-1, #CDE8E5)',
    foreground: 'var(--text-visual-green-2, #0D6E72)',
  },
  {
    background: 'var(--bg-visual-violet-2, #F1E9FF)',
    foreground: 'var(--text-visual-violet-1, #7C3AED)',
  },
  {
    background: 'var(--bg-visual-brown, #FDE8D8)',
    foreground: 'var(--text-visual-brown-2, #B45309)',
  },
  {
    background: 'var(--bg-visual-red, #FCE7F3)',
    foreground: 'var(--text-visual-red, #9D174D)',
  },
  {
    background: 'var(--bg-visual-green-2, #D1F0DC)',
    foreground: 'var(--text-visual-green-3, #065F46)',
  },
  {
    background: 'var(--bg-visual-blue, #D6EDF9)',
    foreground: 'var(--text-accent, #1D4ED8)',
  },
  {
    background: 'var(--bg-visual-violet-1, #DDE3F9)',
    foreground: 'var(--text-visual-violet-2, #3730B7)',
  },
];

/** Returns a deterministic colour-pair for the given display name. */
export const pickAvatarColor = (name: string): AvatarColorEntry => {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return PALETTE[sum % PALETTE.length];
};
