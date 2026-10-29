/** Returns the first element whose `aria-labelledby` lists `labelId`, or `null` if none exists. */
export const findElementLabelledBy = (labelId: string): Element | null =>
  Array.from(document.querySelectorAll('[aria-labelledby]')).find((element) =>
    (element.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .includes(labelId),
  ) ?? null;
