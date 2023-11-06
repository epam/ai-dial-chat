export type Styles = { [property in keyof CSSStyleDeclaration]?: string };

/**
 * Add styles to the html element
 * @param htmlElement {HTMLElement} element for which styles should be added
 * @param styles {Styles} styles that should be added to element
 */
export function setStyles(htmlElement: HTMLElement, styles: Styles): void {
  for (const key in styles) {
    const value = styles[key];

    if (!value) continue;

    htmlElement.style[key] = value;
  }
}
