/** Returns whether the element lays out right-to-left. */
const isRtl = (el: HTMLElement): boolean =>
  window.getComputedStyle(el).direction === 'rtl';

/**
 * Returns the physical horizontal distance, in px, that `row` must scroll for
 * `card`'s inline-start edge to meet the row's inline-start padding edge.
 */
export const getRowScrollDelta = (
  row: HTMLElement,
  card: HTMLElement,
): number => {
  const rowRect = row.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const style = window.getComputedStyle(row);
  if (isRtl(row)) {
    return (
      cardRect.right - (rowRect.right - parseFloat(style.paddingRight || '0'))
    );
  }
  return cardRect.left - (rowRect.left + parseFloat(style.paddingLeft || '0'));
};

/** Returns the index of the card closest to the row's inline-start edge; the last index once the row is scrolled to its end. */
export const getRowActiveIndex = (
  row: HTMLElement,
  cards: HTMLElement[],
): number => {
  if (cards.length === 0) return 0;
  // scrollLeft is negative in RTL rows, so compare magnitudes.
  const isAtEnd =
    Math.abs(row.scrollLeft) + row.clientWidth >= row.scrollWidth - 1;
  if (isAtEnd && Math.abs(row.scrollLeft) > 0) return cards.length - 1;

  let activeIndex = 0;
  let minDistance = Infinity;
  cards.forEach((card, index) => {
    const distance = Math.abs(getRowScrollDelta(row, card));
    if (distance < minDistance) {
      minDistance = distance;
      activeIndex = index;
    }
  });
  return activeIndex;
};
