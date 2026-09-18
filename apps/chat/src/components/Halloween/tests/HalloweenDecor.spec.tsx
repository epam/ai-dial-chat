import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HALLOWEEN_DECOR_BAT_COUNT } from '../../../constants/halloween';
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

  it('keeps the cobwebs and bats out of the accessibility tree', () => {
    mockHalloween(true);
    render(<HalloweenDecor />);

    const bats = screen.getAllByText('🦇');
    expect(bats).toHaveLength(HALLOWEEN_DECOR_BAT_COUNT);
    /* The `aria-hidden` wrapper is the point of the assertion, and no Testing
       Library query can reach a node *because* it is hidden. */
    bats.forEach((bat) =>
      // eslint-disable-next-line testing-library/no-node-access
      expect(bat.closest('[aria-hidden="true"]')).not.toBeNull(),
    );
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
