import type { VisualizerConnectorLoaderStyles } from '../../models/visualizer-connector';

/** Assigns each non-empty declaration in `styles` to `element.style`. */
export const setStyles = (
  element: HTMLElement,
  styles: VisualizerConnectorLoaderStyles,
): void => {
  for (const key of Object.keys(styles) as (keyof CSSStyleDeclaration)[]) {
    const value = styles[key];
    if (!value) {
      continue;
    }
    (element.style as unknown as Record<string, string>)[key as string] = value;
  }
};
