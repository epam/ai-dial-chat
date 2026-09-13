/**
 * Matches a `{{name}}` or `{{name|defaultValue}}` placeholder. The inner run
 * excludes braces so a stray `{{` cannot swallow the rest of the document, and
 * it must be non-empty so a literal `{{}}` stays plain text.
 */
export const PROMPT_PARAM_PATTERN = /\{\{([^{}]+)\}\}/g;

/** Class applied to each highlighted placeholder. The host owns its styling. */
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
  PROMPT_PARAM_PATTERN.lastIndex = 0;
  const parts: HastNode[] = [];
  let lastIndex = 0;
  let match = PROMPT_PARAM_PATTERN.exec(value);

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
    match = PROMPT_PARAM_PATTERN.exec(value);
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

/**
 * Separator between a parameter's name and its default value inside a token.
 * `{{language|Spanish}}` names the parameter `language` and offers `Spanish`
 * as its starting value. It is the form the classic chat's prompt editor
 * documents, so prompts authored there carry it.
 */
export const PROMPT_PARAM_DEFAULT_SEPARATOR = '|';

/** A `{{name}}` or `{{name|defaultValue}}` parameter read out of a prompt. */
export interface PromptParameter {
  /** The parameter's name — the label a host shows, and the key its value is read by. */
  name: string;
  /**
   * The value the field starts with, when the token carried one. Absent for a
   * bare `{{name}}` token.
   */
  defaultValue?: string;
}

/*
 * Only the first separator splits the token, so a default may itself contain
 * pipes (`{{sep|a|b}}` defaults to `a|b`). Neither half is trimmed: the name
 * has to stay byte-identical to the token so substitution keeps matching it,
 * and a default's surrounding spaces are part of what the author wrote.
 */
const parsePromptParam = (token: string): PromptParameter => {
  const separatorIndex = token.indexOf(PROMPT_PARAM_DEFAULT_SEPARATOR);
  if (separatorIndex === -1) return { name: token };

  return {
    name: token.slice(0, separatorIndex),
    defaultValue: token.slice(separatorIndex + 1),
  };
};

/**
 * Returns the distinct parameters found in `content`, in first-occurrence
 * order. Single-brace sequences (e.g. `{name}`) are not parameters. When one
 * name appears more than once the first occurrence decides the default, so the
 * parameter is still asked for once.
 */
export const extractPromptParams = (content: string): PromptParameter[] => {
  PROMPT_PARAM_PATTERN.lastIndex = 0;
  const byName = new Map<string, PromptParameter>();
  let match = PROMPT_PARAM_PATTERN.exec(content);

  while (match != null) {
    const parameter = parsePromptParam(match[1]);
    if (!byName.has(parameter.name)) byName.set(parameter.name, parameter);
    match = PROMPT_PARAM_PATTERN.exec(content);
  }

  return Array.from(byName.values());
};

/**
 * Replaces every parameter occurrence in `content` with the matching entry in
 * `values` (keyed by parameter name), falling back to the token's own default
 * value. A token with neither is left unchanged.
 */
export const resolvePromptParams = (
  content: string,
  values: Record<string, string>,
): string =>
  content.replace(PROMPT_PARAM_PATTERN, (match, token: string) => {
    const { name, defaultValue } = parsePromptParam(token);
    return values[name] ?? defaultValue ?? match;
  });

/**
 * Returns the starting values for `parameters`, keyed by name — one entry per
 * parameter that carries a default, and nothing for the rest.
 */
export const buildPromptParamDefaults = (
  parameters: PromptParameter[],
): Record<string, string> => {
  const defaults: Record<string, string> = {};
  for (const { name, defaultValue } of parameters) {
    if (defaultValue != null) defaults[name] = defaultValue;
  }
  return defaults;
};
