/** Matches every control the share popover treats as tab-navigable. */
const INTERACTIVE_ELEMENTS_SELECTOR =
  'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Returns the tab-navigable controls inside `container`, in DOM order. */
export const getInteractiveElements = (
  container: HTMLElement | null,
): HTMLElement[] =>
  Array.from(
    container?.querySelectorAll<HTMLElement>(INTERACTIVE_ELEMENTS_SELECTOR) ??
      [],
  );

/**
 * Moves focus to the first tab-navigable control inside `container`, falling
 * back to `container` itself when it holds none.
 */
export const focusFirstInteractiveElement = (
  container: HTMLElement | null,
): void => {
  const [firstElement] = getInteractiveElements(container);
  (firstElement ?? container)?.focus();
};
