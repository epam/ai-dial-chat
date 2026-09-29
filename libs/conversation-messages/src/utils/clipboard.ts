import type { ClipboardEvent } from 'react';

/*
 * Attributes that carry meaning rather than look. Everything else — `class`,
 * `style`, `id`, `aria-*`, `data-*` — is dropped, because it only means
 * something inside this app.
 */
const PRESERVED_ATTRIBUTES = [
  'href',
  'src',
  'alt',
  'colspan',
  'rowspan',
  'start',
];

const PRESERVED_WHITE_SPACE = new Set([
  'pre',
  'pre-wrap',
  'pre-line',
  'break-spaces',
]);

const cloneElementShallow = (element: Element): HTMLElement => {
  const clone = document.createElement(element.tagName.toLowerCase());

  PRESERVED_ATTRIBUTES.forEach((name) => {
    const value = element.getAttribute(name);
    if (value !== null) clone.setAttribute(name, value);
  });

  /*
   * `white-space` is the one computed style kept: a user message relies on
   * `pre-wrap` for its line breaks, and without it a rich-text target would
   * collapse a multi-line message onto one line.
   */
  const { whiteSpace } = window.getComputedStyle(element);
  if (PRESERVED_WHITE_SPACE.has(whiteSpace)) {
    clone.style.whiteSpace = 'pre-wrap';
  }

  return clone;
};

const isSkippedElement = (element: Element): boolean =>
  element instanceof SVGElement ||
  window.getComputedStyle(element).display === 'none';

const cloneNodeInRange = (node: Node, range: Range): Node | null => {
  if (!range.intersectsNode(node)) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node as Text).data;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : text.length;

    return document.createTextNode(text.slice(start, end));
  }

  if (!(node instanceof Element) || isSkippedElement(node)) return null;

  const clone = cloneElementShallow(node);
  node.childNodes.forEach((child) => {
    const childClone = cloneNodeInRange(child, range);
    if (childClone) clone.appendChild(childClone);
  });

  return clone;
};

/*
 * Wraps the cloned range in its ancestors up to `boundary`, so a selection
 * inside a code block, list, or table keeps the `<pre>`/`<ul>`/`<table>` that
 * gives it its structure.
 */
const wrapInAncestors = (
  content: Node,
  from: Element | null,
  boundary: Element,
): Node => {
  let wrapped = content;
  let ancestor = from;

  while (ancestor && ancestor !== boundary && boundary.contains(ancestor)) {
    const wrapper = cloneElementShallow(ancestor);
    wrapper.appendChild(wrapped);
    wrapped = wrapper;
    ancestor = ancestor.parentElement;
  }

  return wrapped;
};

const serializeRange = (range: Range, boundary: Element): Node | null => {
  const common = range.commonAncestorContainer;
  const root = common instanceof Element ? common : common.parentElement;
  if (!root) return null;

  const content = cloneNodeInRange(root, range);
  if (!content) return null;

  return wrapInAncestors(content, root.parentElement, boundary);
};

/**
 * `onCopy` handler that writes the current selection to the clipboard without
 * the app's colors and fonts. Left to itself, the browser inlines every
 * computed style of the selected markup into `text/html`, so pasting into a
 * rich-text target (Teams, Outlook, Word) brings along the message's
 * background band. This keeps the structure (paragraphs, lists, tables, code,
 * links, line breaks) and lets the target document style it.
 */
export const copySelectionWithoutStyles = (
  event: ClipboardEvent<HTMLElement>,
): void => {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.isCollapsed ||
    selection.rangeCount === 0 ||
    !event.clipboardData
  ) {
    return;
  }

  const plainText = selection.toString();
  if (!plainText) return;

  const container = document.createElement('div');
  for (let index = 0; index < selection.rangeCount; index++) {
    const serialized = serializeRange(
      selection.getRangeAt(index),
      event.currentTarget,
    );
    if (serialized) container.appendChild(serialized);
  }

  event.clipboardData.setData('text/html', container.innerHTML);
  event.clipboardData.setData('text/plain', plainText);
  event.preventDefault();
};
