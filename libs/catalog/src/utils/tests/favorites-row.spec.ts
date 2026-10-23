import { afterEach, describe, expect, it } from 'vitest';
import { getRowActiveIndex, getRowScrollDelta } from '../favorites-row';

const ROW_WIDTH = 300;
const CARD_WIDTH = 250;
const GAP = 10;
const PADDING = 4;

/** Builds a row whose cards sit `scroll` px along the inline axis, laid out in the given direction. */
const buildRow = (
  cardCount: number,
  { scroll = 0, dir = 'ltr' }: { scroll?: number; dir?: 'ltr' | 'rtl' } = {},
) => {
  const row = document.createElement('div');
  // jsdom does not map the `dir` attribute onto computed `direction`.
  row.style.direction = dir;
  row.style.paddingLeft = `${PADDING}px`;
  row.style.paddingRight = `${PADDING}px`;
  const contentWidth =
    PADDING * 2 + cardCount * CARD_WIDTH + (cardCount - 1) * GAP;
  Object.defineProperties(row, {
    clientWidth: { value: ROW_WIDTH },
    scrollWidth: { value: contentWidth },
    // scrollLeft runs negative in RTL.
    scrollLeft: { value: dir === 'rtl' ? -scroll : scroll },
  });
  row.getBoundingClientRect = () =>
    new DOMRect(0, 0, ROW_WIDTH, 100) as DOMRect;

  const cards = Array.from({ length: cardCount }, (_, index) => {
    const card = document.createElement('div');
    const offset = PADDING + index * (CARD_WIDTH + GAP) - scroll;
    const left = dir === 'rtl' ? ROW_WIDTH - offset - CARD_WIDTH : offset;
    card.getBoundingClientRect = () =>
      new DOMRect(left, 0, CARD_WIDTH, 100) as DOMRect;
    row.appendChild(card);
    return card;
  });
  document.body.appendChild(row);
  return { row, cards };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getRowScrollDelta', () => {
  it('returns the distance from a card to the row start in LTR', () => {
    const { row, cards } = buildRow(3);

    expect(getRowScrollDelta(row, cards[0])).toBe(0);
    expect(getRowScrollDelta(row, cards[1])).toBe(CARD_WIDTH + GAP);
  });

  it('returns a negative distance toward the start edge in RTL', () => {
    const { row, cards } = buildRow(3, { dir: 'rtl' });

    expect(getRowScrollDelta(row, cards[0])).toBe(0);
    expect(getRowScrollDelta(row, cards[1])).toBe(-(CARD_WIDTH + GAP));
  });
});

describe('getRowActiveIndex', () => {
  it('returns the card nearest the start edge', () => {
    const { row, cards } = buildRow(4, { scroll: CARD_WIDTH + GAP - 20 });

    expect(getRowActiveIndex(row, cards)).toBe(1);
  });

  it('returns the card nearest the start edge in RTL', () => {
    const { row, cards } = buildRow(4, {
      scroll: CARD_WIDTH + GAP + 20,
      dir: 'rtl',
    });

    expect(getRowActiveIndex(row, cards)).toBe(1);
  });

  it('returns the last card once the row is scrolled to its end', () => {
    const cardCount = 4;
    const contentWidth =
      PADDING * 2 + cardCount * CARD_WIDTH + (cardCount - 1) * GAP;
    const { row, cards } = buildRow(cardCount, {
      scroll: contentWidth - ROW_WIDTH,
    });

    expect(getRowActiveIndex(row, cards)).toBe(cardCount - 1);
  });

  it('returns the last card at the end of an RTL row', () => {
    const cardCount = 4;
    const contentWidth =
      PADDING * 2 + cardCount * CARD_WIDTH + (cardCount - 1) * GAP;
    const { row, cards } = buildRow(cardCount, {
      scroll: contentWidth - ROW_WIDTH,
      dir: 'rtl',
    });

    expect(getRowActiveIndex(row, cards)).toBe(cardCount - 1);
  });

  it('returns 0 for a row with no cards', () => {
    const { row } = buildRow(0);

    expect(getRowActiveIndex(row, [])).toBe(0);
  });
});
