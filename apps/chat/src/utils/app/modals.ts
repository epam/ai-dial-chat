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
  contentTokensLength: number,
  maxTokensLength: number,
) => {
  if (contentTokensLength <= maxTokensLength) {
    const remainingCharacters = maxTokensLength - contentTokensLength;
    return `You have entered ${contentTokensLength} tokens and are trying to insert a prompt with more than ${remainingCharacters} tokens. 1 token approximately equals to 4 characters.`;
  }

  return '';
};
