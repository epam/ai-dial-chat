const MHCHEM_CE_REGEX = /\$\\ce\{/g;
const MHCHEM_PU_REGEX = /\$\\pu\{/g;
const MHCHEM_CE_ESCAPED_REGEX = /\$\\\\ce\{[^}]*\}\$/g;
const MHCHEM_PU_ESCAPED_REGEX = /\$\\\\pu\{[^}]*\}\$/g;
const CURRENCY_REGEX =
  /(?<![\\$])\$(?!\$)(?=\d+(?:,\d{3})*(?:\.\d+)?(?:[KMBkmb])?(?:\s|$|[^a-zA-Z\d]))/g;
const SINGLE_DOLLAR_REGEX =
  /(?<!\\)\$(?!\$)((?:[^$\n]|\\[$])+?)(?<!\\)(?<!`)\$(?!\$)/g;

/** Converts single-dollar mhchem expressions (`$\ce{...}$`, `$\pu{...}$`) to the double-dollar form KaTeX expects. */
const escapeMhchem = (text: string): string => {
  let result = text.replace(MHCHEM_CE_REGEX, '$\\\\ce{');
  result = result.replace(MHCHEM_PU_REGEX, '$\\\\pu{');
  result = result.replace(MHCHEM_CE_ESCAPED_REGEX, (match) => `$${match}$`);
  result = result.replace(MHCHEM_PU_ESCAPED_REGEX, (match) => `$${match}$`);
  return result;
};

/** Returns the `[start, end]` index ranges of inline and fenced code blocks in `content`. */
const findCodeBlockRegions = (content: string): [number, number][] => {
  const regions: [number, number][] = [];
  let inlineStart = -1;
  let multilineStart = -1;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (
      char === '`' &&
      i + 2 < content.length &&
      content[i + 1] === '`' &&
      content[i + 2] === '`'
    ) {
      if (multilineStart === -1) {
        multilineStart = i;
        i += 2;
      } else {
        regions.push([multilineStart, i + 2]);
        multilineStart = -1;
        i += 2;
      }
    } else if (char === '`' && multilineStart === -1) {
      if (inlineStart === -1) {
        inlineStart = i;
      } else {
        regions.push([inlineStart, i]);
        inlineStart = -1;
      }
    }
  }

  return regions;
};

/** Binary-searches `codeRegions` (sorted, non-overlapping) for whether `position` falls inside one. */
const isInCodeBlock = (
  position: number,
  codeRegions: [number, number][],
): boolean => {
  let left = 0;
  let right = codeRegions.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const [start, end] = codeRegions[mid];

    if (position >= start && position <= end) {
      return true;
    } else if (position < start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return false;
};

/**
 * Escapes currency-looking dollar signs and converts single-dollar LaTeX math delimiters
 * (`$...$`) to the double-dollar form (`$$...$$`) that `remark-math`/KaTeX render, leaving
 * code blocks and already-escaped `\$` untouched.
 *
 * The `\(...\)`/`\[...\]` delimiters LLMs commonly emit are deliberately left as-is: they are
 * recognized directly by `micromark-extension-llm-math`, which the consuming app's bundler
 * config aliases in place of the default `micromark-extension-math` used by `remark-math`.
 */
export const preprocessLaTeX = (content: string): string => {
  if (!content.includes('$')) return content;

  let processed = content;
  if (content.includes('\\ce{') || content.includes('\\pu{')) {
    processed = escapeMhchem(content);
  }

  const codeRegions = findCodeBlockRegions(processed);

  const currencyEscapedParts: string[] = [];
  let lastIndex = 0;
  CURRENCY_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CURRENCY_REGEX.exec(processed)) !== null) {
    if (!isInCodeBlock(match.index, codeRegions)) {
      currencyEscapedParts.push(processed.substring(lastIndex, match.index));
      currencyEscapedParts.push('\\$');
      lastIndex = match.index + 1;
    }
  }
  currencyEscapedParts.push(processed.substring(lastIndex));
  processed = currencyEscapedParts.join('');

  const result: string[] = [];
  lastIndex = 0;
  SINGLE_DOLLAR_REGEX.lastIndex = 0;

  while ((match = SINGLE_DOLLAR_REGEX.exec(processed)) !== null) {
    if (!isInCodeBlock(match.index, codeRegions)) {
      result.push(processed.substring(lastIndex, match.index));
      result.push(`$$${match[1]}$$`);
      lastIndex = match.index + match[0].length;
    }
  }
  result.push(processed.substring(lastIndex));

  return result.join('');
};
