/** Minimal hast node shape walked by {@link rehypePreserveSpaces}. */
interface HastNodeLike {
  /** Node type — `'element'`, `'text'`, `'root'`, … */
  type: string;
  /** Tag name of an element node. */
  tagName?: string;
  /** Text of a text node. */
  value?: string;
  /** Child nodes of a parent node. */
  children?: HastNodeLike[];
}

/* Elements whose text keeps its own whitespace semantics: code is rendered
 * with `white-space: pre`, and MathML spacing is owned by KaTeX. */
const SKIPPED_TAGS = new Set(['code', 'pre', 'math', 'script', 'style']);

const NBSP = String.fromCharCode(0xa0);

const MULTIPLE_SPACES = / {2,}/g;

/* The run keeps one ordinary space at its end, so the line can still wrap
 * there and the next line never starts with a non-breaking space. */
const preserveSpaceRun = (run: string): string =>
  `${NBSP.repeat(run.length - 1)} `;

const preserveSpaces = (node: HastNodeLike): void => {
  if (node.type === 'text' && node.value) {
    node.value = node.value.replace(MULTIPLE_SPACES, preserveSpaceRun);
    return;
  }
  if (
    node.type === 'element' &&
    node.tagName &&
    SKIPPED_TAGS.has(node.tagName)
  ) {
    return;
  }
  node.children?.forEach(preserveSpaces);
};

/** Rehype plugin that keeps runs of consecutive spaces in prose visible instead of letting HTML collapse them to one. */
export const rehypePreserveSpaces = () => (tree: HastNodeLike) => {
  preserveSpaces(tree);
};
