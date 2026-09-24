import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
/** The horizontal displacement out of the spider's inline transform. */
const readOffsetX = (spider: HTMLElement) =>
  Number.parseFloat(
    /translate3d\((-?[\d.]+)px/.exec(spider.style.transform)?.[1] ?? 'NaN',
  );

const movePointer = (x: number, y: number) =>
  fireEvent(
    window,
    new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }),
  );

describe('HalloweenDecor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => vi.restoreAllMocks());

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

    /* Two webs, two spiders, and the pumpkin. */
    expect(queryDrawings()).toHaveLength(5);
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

  it('never flips a spider, so both flee in screen coordinates', () => {
    mockHalloween(true);
    render(<HalloweenDecor />);

    /* The webs are mirrored to face their corner. A mirror on the corner
       itself would take the spider with it and invert its inline transform —
       it would then run towards the pointer and jam against its leash, which
       is exactly the bug this pins down. */
    queryCornerSpiders().forEach((spider) =>
      // eslint-disable-next-line testing-library/no-node-access
      expect(spider.closest('[class*="scale-x-"]')).toBeNull(),
    );
  });

  it('bolts the same way in either corner', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    const [start, end] = queryCornerSpiders();
    perch(start, 100, 100);
    perch(end, 900, 100);
    fireEvent(window, new Event('resize'));

    /* Approached one at a time: moves are coalesced into a frame, so firing
       both before yielding would only ever deliver the last position. A
       pointer to the left of each — both must move right, whatever corner
       they are in. */
    movePointer(60, 100);
    await waitFor(() => expect(readOffsetX(start)).toBeGreaterThan(0));

    movePointer(860, 100);
    await waitFor(() => expect(readOffsetX(end)).toBeGreaterThan(0));
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

    act(() => vi.advanceTimersByTime(HALLOWEEN_SPIDER_RETURN_MS));
    await waitFor(() =>
      expect(spider.style.transform).toContain('translate3d(0px, 0px'),
    );
    vi.useRealTimers();
  });

  it('supports random scenes from the keyboard', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    const user = userEvent.setup();
    await user.tab();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'halloween.pumpkinLabel' }),
    );
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(celebrate).toHaveBeenNthCalledWith(1, HalloweenBurst.Ghost);
    expect(celebrate).toHaveBeenNthCalledWith(2, HalloweenBurst.Web);
  });

  it('plays the selected scene on a single click', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    await clickPumpkin();

    expect(celebrate).toHaveBeenCalledExactlyOnceWith(HalloweenBurst.Ghost);
  });

  it('can start with witches and never repeats a scene on consecutive clicks', async () => {
    vi.mocked(Math.random).mockReturnValue(0.99);
    mockHalloween(true);
    render(<HalloweenDecor />);
    for (let i = 0; i < 6; i += 1) await clickPumpkin();
    const scenes = celebrate.mock.calls.map(([burst]) => burst);
    expect(scenes[0]).toBe(HalloweenBurst.Witches);
    scenes.slice(1).forEach((scene, index) => {
      expect(scene).not.toBe(scenes[index]);
    });
  });
});
