import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Strict allowlist of inline CSS properties that are safe to render in
 * user-controlled markdown (entity descriptions). Deliberately limited to
 * harmless text styling — NO layout/positioning, transforms, or any property
 * able to load an external resource. Property names are matched lower-cased.
 */
const ALLOWED_STYLE_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'font-size',
  'text-decoration',
  'text-align',
  'text-transform',
  'line-height',
  'letter-spacing',
]);

/**
 * Characters permitted inside a style *value*. Notably excludes backslash (CSS
 * escapes such as `\75rl(`), angle brackets, `@` (at-rules), `/` and `*`
 * (comments), `:`/`;` (declaration delimiters) and `!` (`!important`). Permits
 * what colour/length/keyword values need: letters, digits, whitespace, `#`,
 * `%`, `.`, `,`, parentheses (for `rgb()`/`hsl()`), quotes and `+`/`-`.
 */
const SAFE_VALUE_PATTERN = /^[a-z0-9\s#%.,()'"+-]*$/i;

/**
 * Function forms that can load external resources or execute code. Because
 * backslash is already rejected, escapes cannot be used to reconstruct them,
 * so a simple (case-insensitive) match on the literal function call is robust.
 */
const FORBIDDEN_VALUE_FUNCTIONS = [/url\s*\(/i, /expression\s*\(/i];

/**
 * Sanitizes a raw inline `style` string down to an allowlisted, safe subset.
 * Each declaration must have an allowlisted property and a value that both
 * matches the safe character set and contains no resource-loading functions.
 * Anything else is dropped.
 */
export const sanitizeInlineStyle = (rawStyle: string): string => {
  const safeDeclarations: string[] = [];

  for (const declaration of rawStyle.split(';')) {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();

    if (!property || !value || !ALLOWED_STYLE_PROPERTIES.has(property)) {
      continue;
    }

    if (!SAFE_VALUE_PATTERN.test(value)) {
      continue;
    }

    if (FORBIDDEN_VALUE_FUNCTIONS.some((pattern) => pattern.test(value))) {
      continue;
    }

    safeDeclarations.push(`${property}: ${value}`);
  }

  return safeDeclarations.join('; ');
};

/**
 * Rehype plugin that enforces {@link sanitizeInlineStyle} on every element's
 * inline `style` attribute. Allows basic colored/emphasized text in entity
 * descriptions while preventing CSS-based UI redressing (overlays via
 * position/z-index/transform/margin) and data exfiltration (`url()`).
 */
export const rehypeSanitizeInlineStyles = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const style = node.properties?.style;
      if (typeof style !== 'string') {
        return;
      }

      const cleanStyle = sanitizeInlineStyle(style);
      if (cleanStyle) {
        node.properties.style = cleanStyle;
      } else {
        delete node.properties.style;
      }
    });
  };
};
