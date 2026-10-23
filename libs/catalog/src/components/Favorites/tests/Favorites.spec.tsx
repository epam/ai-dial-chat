import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { Favorites } from '../Favorites';

const viewport = vi.hoisted(() => ({ isMobile: false }));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: () => viewport.isMobile };
});

const makeItems = (count: number): CatalogItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `fav-${index + 1}`,
    type: CatalogEntityType.Agent,
    name: `Fav ${index + 1}`,
    version: '1.0',
    description: '',
    topics: [],
    folder: [],
    lastUsed: '',
  }));

const getCards = () => screen.queryAllByLabelText(/^Fav \d+$/);

describe('Favorites — desktop grid', () => {
  beforeEach(() => {
    viewport.isMobile = false;
    // 1024px → 4 columns × 2 rows = 8 cards per page.
    window.innerWidth = 1024;
  });

  it('pages through the favorites', async () => {
    render(<Favorites items={makeItems(10)} />);

    expect(getCards()).toHaveLength(8);
    expect(screen.getByText('1 / 2')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(getCards()).toHaveLength(2);
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('shows every favorite without a pager when pagination is hidden', () => {
    render(<Favorites items={makeItems(10)} isPaginationHidden />);

    expect(getCards()).toHaveLength(10);
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });
});

describe('Favorites — mount animation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('releases the wrapper height under StrictMode', () => {
    vi.useFakeTimers();
    // A height transition reads 0 at its start, as a browser does.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.style.transition ? 0 : 150;
      },
    );

    render(
      <StrictMode>
        <Favorites items={makeItems(2)} />
      </StrictMode>,
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // eslint-disable-next-line testing-library/no-node-access
    const wrapper = getCards()[0].closest('section')?.parentElement;
    expect(wrapper?.style.height).toBe('');
  });
});

describe('Favorites — mobile row', () => {
  const ROW_WIDTH = 300;
  const CARD_STEP = 260;
  // How far the row is scrolled; the fake layout below reads it.
  let rowScroll = 0;
  const scrollBy = vi.fn();
  const frames: FrameRequestCallback[] = [];

  const getRow = () =>
    // eslint-disable-next-line testing-library/no-node-access
    getCards()[0].parentElement as HTMLElement;

  /** Scrolls the fake row to `card` (0-based) and fires the scroll event. */
  const swipeTo = (card: number) => {
    rowScroll = card * CARD_STEP;
    fireEvent.scroll(getRow());
    act(() => {
      frames.splice(0).forEach((frame) => frame(0));
    });
  };

  beforeEach(() => {
    viewport.isMobile = true;
    rowScroll = 0;
    frames.length = 0;
    scrollBy.mockClear();
    // jsdom has no scrollBy of its own.
    Element.prototype.scrollBy = scrollBy;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((frame) =>
      frames.push(frame),
    );
    // Cards sit CARD_STEP apart along the row, shifted by its scroll offset.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const { parentElement } = this;
        if (this.dataset.cardId && parentElement) {
          // eslint-disable-next-line testing-library/no-node-access
          const index = Array.from(parentElement.children).indexOf(this);
          return new DOMRect(index * CARD_STEP - rowScroll, 0, 250, 100);
        }
        return new DOMRect(0, 0, ROW_WIDTH, 100);
      },
    );
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollBy;
    vi.restoreAllMocks();
  });

  it('renders every favorite in one scrollable row', () => {
    render(<Favorites items={makeItems(10)} />);

    expect(getCards()).toHaveLength(10);
    const row = getRow();
    expect(row.className).toContain('grid-flow-col');
    expect(row.className).toContain('overflow-x-auto');
    expect(row.style.gridTemplateColumns).toBe('');
  });

  it('keeps the pager, stepping one card at a time by scrolling the row', async () => {
    render(<Favorites items={makeItems(3)} />);

    expect(screen.getByText('1 / 3')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(scrollBy).toHaveBeenCalledWith({
      left: CARD_STEP,
      behavior: 'smooth',
    });
    expect(getCards()).toHaveLength(3);
  });

  it('moves the counter to the card the user swiped to', () => {
    render(<Favorites items={makeItems(3)} />);

    swipeTo(2);

    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('holds the counter on the tapped page while the row scrolls there', async () => {
    render(<Favorites items={makeItems(3)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    // A frame early in the smooth scroll still has card 1 nearest the start.
    swipeTo(0);

    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).toHaveProperty('disabled', false);
  });

  it('advances from the tapped page on a second tap mid-scroll', async () => {
    render(<Favorites items={makeItems(3)} />);

    const next = screen.getByRole('button', { name: 'Next page' });
    await userEvent.click(next);
    swipeTo(0);
    await userEvent.click(next);

    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(scrollBy).toHaveBeenLastCalledWith({
      left: 2 * CARD_STEP,
      behavior: 'smooth',
    });
  });

  it('follows swipes again once the tapped scroll ends', async () => {
    render(<Favorites items={makeItems(3)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    swipeTo(1);
    swipeTo(0);

    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('drops the pager when pagination is hidden', () => {
    render(<Favorites items={makeItems(3)} isPaginationHidden />);

    expect(getCards()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });
});
