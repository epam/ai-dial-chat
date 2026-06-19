/** A run of consecutive bullet items within an about-content block. */
export interface AboutBulletRun {
  kind: 'bullets';
  items: string[];
}

/** A plain-text paragraph within an about-content block. */
export interface AboutTextRun {
  kind: 'text';
  text: string;
}

/** A single content run — either a list of bullets or a paragraph of text. */
export type AboutRun = AboutBulletRun | AboutTextRun;

/**
 * A parsed section of about content.
 * Sections with a `heading` start with a short non-bullet label line.
 */
export interface AboutBlock {
  /** Optional section heading (e.g. "Capabilities", "Pricing"). */
  heading?: string;
  /** Ordered list of content runs inside this block. */
  runs: AboutRun[];
}

/**
 * Parses a plain-text about description into structured blocks for rendering.
 *
 * Splits on blank lines. Within each chunk the first line becomes a section
 * heading when it is ≤ 60 chars, does not start with `•`, and is followed by
 * more lines. Content lines starting with `•` are grouped into bullet runs;
 * other lines become text paragraph runs.
 */
export const parseAboutContent = (content: string): AboutBlock[] =>
  content
    .trim()
    .split(/\n\n+/)
    .filter((s) => s.trim())
    .map((section) => {
      const lines = section.split('\n').filter((l) => l.trim());
      const firstLine = lines[0] ?? '';
      const isHeading =
        lines.length > 1 &&
        !firstLine.trimStart().startsWith('•') &&
        firstLine.trim().length <= 60;

      const contentLines = isHeading ? lines.slice(1) : lines;
      const runs: AboutRun[] = [];

      for (const line of contentLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('•')) {
          const text = trimmed.replace(/^•\s*/, '');
          const last = runs[runs.length - 1];
          if (last?.kind === 'bullets') {
            last.items.push(text);
          } else {
            runs.push({ kind: 'bullets', items: [text] });
          }
        } else {
          runs.push({ kind: 'text', text: trimmed });
        }
      }

      return { heading: isHeading ? firstLine.trim() : undefined, runs };
    });
