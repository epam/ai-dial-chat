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
