export function hasParentWithAttribute(
  element: Element | null,
  attributeName: string,
): boolean {
  if (!element) return false;
  if (element.hasAttribute(attributeName)) {
    return true;
  }
  return hasParentWithAttribute(element.parentElement, attributeName);
}

export function hasParentWithFloatingOverlay(element: Element | null): boolean {
  return hasParentWithAttribute(element, 'data-floating-overlay');
}

export const getPromptLimitDescription = (
  content: string,
  maxLength: number,
) => {
  if (content.length < maxLength) {
    const remainingCharacters = maxLength - content.length;
    return `You have entered ${content.length} characters and are trying to select a prompt with more than ${remainingCharacters} characters.`;
  }

  return '';
};
