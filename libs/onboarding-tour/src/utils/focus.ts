const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Returns whether `element` takes typed text: a text-like input, a textarea, a select or an editable region. */
export const isEditableElement = (element: Element | null): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable
  );
};
