/** Applies each entry of `styles` as an inline style property on `element`. */
export const setStyles = (
  element: HTMLElement,
  styles: Record<string, string>,
): void => {
  Object.assign(element.style, styles);
};

/**
 * Appends a `<style id="{id}">` element carrying `css` to `document.head`,
 * once per document. Repeat calls with the same `id` are a no-op, so every
 * overlay instance can call it during construction.
 */
export const injectStyleSheet = (id: string, css: string): void => {
  if (document.getElementById(id)) {
    return;
  }
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
};
