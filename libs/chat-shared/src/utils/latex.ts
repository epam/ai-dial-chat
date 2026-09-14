const MHCHEM_CE_REGEX = /\$\\ce\{/g;
const MHCHEM_PU_REGEX = /\$\\pu\{/g;
const MHCHEM_CE_ESCAPED_REGEX = /\$\\\\ce\{[^}]*\}\$/g;
const MHCHEM_PU_ESCAPED_REGEX = /\$\\\\pu\{[^}]*\}\$/g;

/** A `$$ ... $$` span, non-greedy so the nearest closing fence wins. */
const DISPLAY_MATH_REGEX = /\$\$([\s\S]*?)\$\$/g;
/** A leading blank line inside a display span, stripped before the fence is rebuilt. */
const LEADING_FENCE_BREAK_REGEX = /^[ \t]*\r?\n/;
/** A trailing blank line inside a display span, stripped before the fence is rebuilt. */
const TRAILING_FENCE_BREAK_REGEX = /\r?\n[ \t]*$/;

/** A currency-shaped amount directly after a `$`: `50`, `1,000.25`, `1.5B`, `250k`. */
const CURRENCY_AMOUNT_REGEX = /\d+(?:,\d{3})*(?:\.\d+)?(?:[KMBkmb])?/y;
/** What may follow an amount for it to still read as money rather than as a symbol name. */
const CURRENCY_TERMINATOR_REGEX = /\s|[^a-zA-Z\d]/y;
/** LaTeX syntax glued straight onto the amount: `$2^n$`, `$2_i$`, `$2\pi$`. */
const MATH_SUFFIX_REGEX = /[\^_\\]/y;
/**
 * A relation after the amount: `$0 < x$`, `$0 \le \infty$`. Prose adds and subtracts
 * prices (`$500 + $200 = $850`) but never orders them, so an inequality marks the run
 * as a formula. `=` is deliberately absent — arithmetic prose is full of it.
 *
 * The whitespace before the relation is consumed by {@link skipWhitespace} rather
 * than by a leading `\s*` here: no alternative can start with whitespace, so a
 * `\s*` left without a matching alternative makes the engine retry from every
 * offset of the run it just consumed, costing quadratic time on a long run of
 * spaces or tabs (CodeQL js/polynomial-redos). The index scan is linear.
 */
const MATH_RELATION_REGEX =
  /(?:[<>]|\\(?:le|leq|ll|ge|geq|gg|ne|neq|approx|equiv|sim|simeq|cong|in|notin|subset|subseteq|supset|supseteq|to|rightarrow|leftarrow|mapsto|implies|iff)\b)/y;

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

/** Runs a sticky regex anchored at `index` and returns the match, or `null`. */
const matchAt = (
  regex: RegExp,
  content: string,
  index: number,
): RegExpExecArray | null => {
  regex.lastIndex = index;
  return regex.exec(content);
};

/** Matches a single whitespace character; used by {@link skipWhitespace}. */
const WHITESPACE_REGEX = /\s/;

/**
 * Returns the index of the first non-whitespace character at or after `index`.
 * Scans by index instead of letting a regex quantifier consume the run, for the
 * reason given on {@link MATH_RELATION_REGEX}.
 */
const skipWhitespace = (content: string, index: number): number => {
  let i = index;
  while (i < content.length && WHITESPACE_REGEX.test(content[i])) i++;
  return i;
};

/**
 * Rewrites `$$ ... $$` display blocks so the opening and closing fences each sit
 * alone on their line.
 *
 * `remark-math` parses a line-leading `$$` as a fenced block whose remainder is
 * *meta* (silently discarded, exactly like an info string on a code fence), and it
 * only closes on a line holding nothing but `$$`. Models routinely emit
 * `$$\begin{aligned}` … `\end{aligned}$$`, which loses the environment opener and
 * never finds a closing fence — so the block runs to the end of the message and
 * swallows every heading and paragraph after it as raw LaTeX. Normalizing the
 * fences keeps a block that cannot be typeset contained within its own delimiters.
 */
const normalizeDisplayMathFences = (content: string): string => {
  if (!content.includes('$$')) return content;

  const codeRegions = findCodeBlockRegions(content);
  const result: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  DISPLAY_MATH_REGEX.lastIndex = 0;

  while ((match = DISPLAY_MATH_REGEX.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const body = match[1];

    /* Single-line spans are parsed as inline math text, which has no meta rule
       and no closing-fence rule, so they are already safe. */
    if (!body.includes('\n') || isInCodeBlock(start, codeRegions)) continue;

    /* Only a fence that starts its own line is parsed as a block; one that starts
       mid-line is inline math text and, again, already safe. */
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    if (content.slice(lineStart, start).trim() !== '') continue;

    const inner = body
      .replace(LEADING_FENCE_BREAK_REGEX, '')
      .replace(TRAILING_FENCE_BREAK_REGEX, '');
    const lineEnd = content.indexOf('\n', end);
    const tail = content.slice(end, lineEnd === -1 ? content.length : lineEnd);

    result.push(content.slice(lastIndex, start));
    result.push(`$$\n${inner}\n$$${tail.trim() === '' ? '' : '\n'}`);
    lastIndex = end;
  }

  result.push(content.substring(lastIndex));
  return result.join('');
};

/**
 * Returns the index just past a currency-shaped amount starting at `index + 1`,
 * or `-1` when no digits follow the `$`.
 */
const measureAmount = (content: string, index: number): number => {
  const amount = matchAt(CURRENCY_AMOUNT_REGEX, content, index + 1);
  return amount ? index + 1 + amount[0].length : -1;
};

/**
 * Decides whether the amount ending at `amountEnd` reads as money rather than as
 * the opening of a formula. `$50 and`, `$1,000)` and `$2$` are money; `$2n`,
 * `$2^n`, `$2\pi` and `$0 < x$` are not.
 */
const isMoneyLike = (content: string, amountEnd: number): boolean => {
  if (amountEnd >= content.length) return true;
  if (!matchAt(CURRENCY_TERMINATOR_REGEX, content, amountEnd)) return false;
  if (matchAt(MATH_SUFFIX_REGEX, content, amountEnd)) return false;
  if (matchAt(MATH_RELATION_REGEX, content, skipWhitespace(content, amountEnd)))
    return false;
  return true;
};

/**
 * Collects the `$` positions that can act as inline math delimiters: not escaped
 * as `\$`, not part of a `$$` run (which `remark-math` handles on its own), and
 * not inside a code span or fenced block.
 */
const findInlineDelimiters = (
  content: string,
  codeRegions: [number, number][],
): number[] => {
  const positions: number[] = [];

  for (let i = 0; i < content.length; i++) {
    if (content[i] !== '$') continue;

    let runEnd = i;
    while (runEnd + 1 < content.length && content[runEnd + 1] === '$') runEnd++;
    if (runEnd > i) {
      i = runEnd;
      continue;
    }

    if (i > 0 && content[i - 1] === '\\') continue;
    if (isInCodeBlock(i, codeRegions)) continue;

    positions.push(i);
  }

  return positions;
};

/**
 * Whether the delimiter at `close` can close the span opened at `open`. A `$` left
 * literal inside the body — one this pass is neither escaping nor consuming, so a
 * code-span `$` — would reach KaTeX as a stray delimiter and disqualifies the span.
 */
const canClose = (
  content: string,
  open: number,
  close: number,
  replacements: Map<number, string>,
): boolean => {
  if (close <= open + 1) return false;
  /* `` `$lookup` `` and friends: a backtick right before the `$` means code, not math. */
  if (content[close - 1] === '`') return false;

  for (let i = open + 1; i < close; i++) {
    if (content[i] === '\n') return false;
    if (content[i] !== '$') continue;
    if (content[i - 1] === '\\' || replacements.has(i)) continue;
    return false;
  }

  return true;
};

/**
 * Escapes currency-looking dollar signs and converts single-dollar LaTeX math delimiters
 * (`$...$`) to the double-dollar form (`$$...$$`) that `remark-math`/KaTeX render, leaving
 * code blocks and already-escaped `\$` untouched. Display blocks are re-fenced so a
 * formula that cannot be typeset stays inside its own delimiters instead of consuming the
 * rest of the message.
 *
 * Delimiters are paired in a single left-to-right walk rather than by an independent
 * currency pass, because declining to open a formula on one `$` while leaving its partner
 * free to open the next one shifts every pairing along the line — which is how
 * `$0 < x$ and then $y \in H$` used to typeset the English words and print the formulas.
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
  processed = normalizeDisplayMathFences(processed);

  const codeRegions = findCodeBlockRegions(processed);
  const positions = findInlineDelimiters(processed, codeRegions);
  const replacements = new Map<number, string>();

  let open = -1;

  for (let i = 0; i < positions.length; i++) {
    const position = positions[i];
    const amountEnd = measureAmount(processed, position);

    if (amountEnd !== -1 && isMoneyLike(processed, amountEnd)) {
      replacements.set(position, '\\$');

      /* A bare `$2$` declines both of its delimiters, so refusing to open a formula
         never re-pairs the ones further along the line. When a span is already open
         the trailing `$` is its closer (`$A = ... = $1,100$`) and is left alone. */
      if (open === -1 && positions[i + 1] === amountEnd) {
        replacements.set(amountEnd, '\\$');
        i++;
      }
      continue;
    }

    if (open === -1) {
      open = position;
      continue;
    }

    if (canClose(processed, open, position, replacements)) {
      replacements.set(open, '$$');
      replacements.set(position, '$$');
      open = -1;
    } else {
      open = position;
    }
  }

  if (replacements.size === 0) return processed;

  const result: string[] = [];
  let lastIndex = 0;

  for (const index of [...replacements.keys()].sort((a, b) => a - b)) {
    result.push(processed.slice(lastIndex, index));
    result.push(replacements.get(index) as string);
    lastIndex = index + 1;
  }
  result.push(processed.substring(lastIndex));

  return result.join('');
};
