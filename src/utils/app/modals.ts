export function hasParentWithFloatingOverlay(
  element: Element | null,
  attributeName: string,
): boolean {
  if (!element) return false;
  if (element.hasAttribute(attributeName)) {
    return true;
  }
  return hasParentWithFloatingOverlay(element.parentElement, attributeName);
}
