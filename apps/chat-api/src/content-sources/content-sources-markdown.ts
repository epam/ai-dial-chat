import { posix } from 'node:path';

const TITLE_MAX_LENGTH = 200;
const FENCE = /^\s{0,3}(```|~~~)/;
const ATX_H1 = /^ {0,3}#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/;

/** File name without directory or extension: `docs/1.2.0.md` → `1.2.0`. */
export const fileNameTitle = (path: string): string =>
  posix.basename(path, posix.extname(path)) || posix.basename(path);

/**
 * First level-1 heading of a Markdown document (ATX `# Title` or setext
 * `Title` over `===`), ignoring fenced code blocks and a leading YAML front
 * matter block. Returns undefined when there is none.
 */
export const extractFirstH1 = (markdown: string): string | undefined => {
  const text = markdown.charCodeAt(0) === 0xfeff ? markdown.slice(1) : markdown;
  const lines = text.split(/\r?\n/);
  let index = 0;

  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (end > 0) index = end + 1;
  }

  let fence: string | undefined;
  for (; index < lines.length; index++) {
    const line = lines[index];
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fence === fenceMatch[1]) fence = undefined;
      continue;
    }
    if (fence) continue;

    const atx = ATX_H1.exec(line);
    if (atx) return atx[1].trim().slice(0, TITLE_MAX_LENGTH);

    if (
      line.trim() &&
      !line.startsWith('#') &&
      SETEXT_H1.test(lines[index + 1] ?? '')
    ) {
      return line.trim().slice(0, TITLE_MAX_LENGTH);
    }
  }
  return undefined;
};

export const documentTitle = (markdown: string, path: string): string =>
  extractFirstH1(markdown) ?? fileNameTitle(path);
