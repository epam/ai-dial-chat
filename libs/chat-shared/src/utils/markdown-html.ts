/** Minimal hast shape this plugin reads and writes. */
interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
}

const replaceRawNodes = (node: HastNode): void => {
  if (node.children == null) return;

  node.children = node.children.map((child) => {
    if (child.type === 'raw') {
      return { type: 'text', value: child.value ?? '' };
    }
    replaceRawNodes(child);
    return child;
  });
};

/**
 * Rehype plugin that turns every raw HTML node into a text node, so markup in
 * the source renders as the literal characters the author typed instead of
 * being dropped by sanitization.
 */
export const rehypeRawAsText = () => (tree: HastNode) => {
  replaceRawNodes(tree);
};
