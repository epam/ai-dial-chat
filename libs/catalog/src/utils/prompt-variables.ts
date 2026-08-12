/**
 * Matches a `{{name}}` placeholder. The inner run excludes braces so a stray
 * `{{` cannot swallow the rest of the document, and it must be non-empty so a
 * literal `{{}}` stays plain text.
 */
const PROMPT_VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g;

/** Class applied to each highlighted placeholder, styled by the Content tab's stylesheet. */
export const PROMPT_VARIABLE_CLASS_NAME = 'cat-prompt-variable';

/** Minimal hast shapes this plugin reads and writes. */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/*
 * `code` and `pre` are skipped: inside a fenced block a placeholder is being
 * shown as literal syntax, so highlighting it would misrepresent it as live.
 */
const OPAQUE_TAG_NAMES = new Set(['code', 'pre']);

const splitTextNode = (value: string): HastNode[] | null => {
  PROMPT_VARIABLE_PATTERN.lastIndex = 0;
  const parts: HastNode[] = [];
  let lastIndex = 0;
  let match = PROMPT_VARIABLE_PATTERN.exec(value);

  while (match != null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'element',
      tagName: 'span',
      properties: { className: [PROMPT_VARIABLE_CLASS_NAME] },
      children: [{ type: 'text', value: match[0] }],
    });
    lastIndex = match.index + match[0].length;
    match = PROMPT_VARIABLE_PATTERN.exec(value);
  }

  if (parts.length === 0) return null;
  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return parts;
};

const visit = (node: HastNode): void => {
  if (node.children == null) return;
  if (node.tagName != null && OPAQUE_TAG_NAMES.has(node.tagName)) return;

  const next: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && child.value != null) {
      const parts = splitTextNode(child.value);
      next.push(...(parts ?? [child]));
      continue;
    }
    visit(child);
    next.push(child);
  }
  node.children = next;
};

/**
 * Rehype plugin that wraps every `{{name}}` placeholder in a span so it can be
 * styled apart from the surrounding prose. Placeholders inside code are left
 * alone.
 *
 * The spans are built as hast nodes rather than injected as raw HTML, so a
 * placeholder that contains markup cannot escape into the document.
 */
export const rehypePromptVariables = () => (tree: HastNode) => {
  visit(tree);
};
