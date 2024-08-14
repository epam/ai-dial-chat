import { TFunction } from 'next-i18next';

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
  t: TFunction,
) => {
  if (contentTokensLength <= maxTokensLength) {
    const remainingCharacters = maxTokensLength - contentTokensLength;
    return t(
      'chat.chat_input.dialog.prompt_limit_exceeded.prompt_limit_description',
      {
        contentTokensLength: contentTokensLength,
        remainingCharacters: remainingCharacters,
      },
    );
  }

  return '';
};
