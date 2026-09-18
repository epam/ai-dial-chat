import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HALLOWEEN_SPIDER_RETURN_MS } from '../../../constants/halloween';
import { useHalloween } from '../../../context/HalloweenContext';
import { HalloweenBurst } from '../../../types/halloween';
import HalloweenDecor from '../HalloweenDecor';

vi.mock('../../../context/HalloweenContext', () => ({
  useHalloween: vi.fn(),
}));

const mockUseHalloween = vi.mocked(useHalloween);
const celebrate = vi.fn();

const mockHalloween = (isEnabled: boolean) =>
  mockUseHalloween.mockReturnValue({
    isEnabled,
    celebrate,
    consumeSecretPhrase: vi.fn(),
  });

const clickPumpkin = () =>
  userEvent.click(
    screen.getByRole('button', { name: 'halloween.pumpkinLabel' }),
  );

/*
 * The decoration is inline SVG with no accessible name, so no Testing Library
 * query can reach it — and that unreachability is the point.
 */
const queryDrawings = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelectorAll('svg');

/* Each spider carries its displacement as an inline transform, so the
   elements that have one are exactly the corner spiders. */
const queryCornerSpiders = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelectorAll<HTMLElement>('span[style*="translate3d"]');

/*
 * jsdom reports a zero rect for everything, so the two spiders would sit on
 * top of each other at the origin. Pin them somewhere distinguishable and
 * announce it the way a real layout change would.
 */
const perch = (spider: HTMLElement, x: number, y: number) => {
  vi.spyOn(spider, 'getBoundingClientRect').mockReturnValue({
    x,
    y,
    left: x,
    top: y,
    right: x + 24,
    bottom: y + 24,
    width: 24,
    height: 24,
    toJSON: () => ({}),
  });
};

/* Built by hand rather than with `fireEvent.pointerMove`: jsdom has no
   `PointerEvent`, and the fallback it substitutes drops `clientX`/`clientY`,
   which is the whole payload here. */
const movePointer = (x: number, y: number) =>
  fireEvent(
    window,
    new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }),
  );

describe('HalloweenDecor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing while the feature is off', () => {
    mockHalloween(false);
    const { container } = render(<HalloweenDecor />);

    expect(container.innerHTML).toBe('');
  });

  it('renders the pumpkin as a labelled button while the feature is on', () => {
    mockHalloween(true);
    render(<HalloweenDecor />);

    expect(
      screen.getByRole('button', { name: 'halloween.pumpkinLabel' }),
    ).not.toBeNull();
  });

  it('hangs a web and a spider in each top corner', () => {
    mockHalloween(true);
    render(<HalloweenDecor />);

    /* Two webs and two spiders. */
    expect(queryDrawings()).toHaveLength(4);
    expect(queryCornerSpiders()).toHaveLength(2);
  });

  it('keeps the decoration out of the accessibility tree', () => {
    mockHalloween(true);
    render(<HalloweenDecor />);

    queryDrawings().forEach((drawing) =>
      // eslint-disable-next-line testing-library/no-node-access
      expect(drawing.closest('[aria-hidden="true"]')).not.toBeNull(),
    );
  });

  it('bolts when the pointer closes in, and leaves the far corner alone', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    const [near, far] = queryCornerSpiders();
    perch(near, 100, 100);
    perch(far, 900, 100);
    fireEvent(window, new Event('resize'));
    const farAtRest = far.style.transform;

    movePointer(110, 110);

    await waitFor(() =>
      expect(near.style.transform).not.toBe(
        'translate3d(0px, 0px, 0) rotate(0.0deg)',
      ),
    );
    expect(far.style.transform).toBe(farAtRest);
  });

  it('keeps giving ground while the pointer chases it', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    const [spider] = queryCornerSpiders();
    perch(spider, 100, 100);
    fireEvent(window, new Event('resize'));

    movePointer(60, 100);
    let firstDash = '';
    await waitFor(() => {
      firstDash = spider.style.transform;
      expect(firstDash).toContain('translate3d(');
      expect(firstDash).not.toContain('translate3d(0px');
    });

    /* The pointer follows it to where it just went. */
    movePointer(120, 100);
    await waitFor(() => expect(spider.style.transform).not.toBe(firstDash));
  });

  it('creeps back to its perch once the pointer leaves it alone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockHalloween(true);
    render(<HalloweenDecor />);
    const [spider] = queryCornerSpiders();
    perch(spider, 100, 100);
    fireEvent(window, new Event('resize'));

    movePointer(110, 110);
    await waitFor(() =>
      expect(spider.style.transform).not.toContain('translate3d(0px, 0px'),
    );

    vi.advanceTimersByTime(HALLOWEEN_SPIDER_RETURN_MS);
    await waitFor(() =>
      expect(spider.style.transform).toContain('translate3d(0px, 0px'),
    );
    vi.useRealTimers();
  });

  it('releases the ghosts on a single click', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    await clickPumpkin();

    expect(celebrate).toHaveBeenCalledExactlyOnceWith(HalloweenBurst.Ghost);
  });

  it('releases a fresh flock on every further click', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    await clickPumpkin();
    await clickPumpkin();
    await clickPumpkin();

    expect(celebrate).toHaveBeenCalledTimes(3);
  });
});
