import { render, screen, waitFor } from '@testing-library/react';
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

/* The spider sits in the one element that takes pointer events back from the
   decoration layer. */
const queryCornerSpiders = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelectorAll<HTMLElement>('.pointer-events-auto');

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

  it('sends a corner spider scurrying when the pointer reaches it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockHalloween(true);
    render(<HalloweenDecor />);
    const [spider] = queryCornerSpiders();
    const restingClasses = spider.className;

    await userEvent.hover(spider);
    expect(spider.className).not.toBe(restingClasses);

    /* …and creeps back on its own, without a second gesture. */
    vi.advanceTimersByTime(HALLOWEEN_SPIDER_RETURN_MS);
    await waitFor(() => expect(spider.className).toBe(restingClasses));
    vi.useRealTimers();
  });

  it('startles each corner spider independently', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    const [first, second] = queryCornerSpiders();
    const secondAtRest = second.className;

    await userEvent.hover(first);

    expect(second.className).toBe(secondAtRest);
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
