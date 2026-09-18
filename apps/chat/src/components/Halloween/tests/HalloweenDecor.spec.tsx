import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HALLOWEEN_DECOR_BAT_COUNT,
  HALLOWEEN_PUMPKIN_CLICKS,
} from '../../../constants/halloween';
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

const clickPumpkin = async (times: number) => {
  const pumpkin = screen.getByRole('button', {
    name: 'halloween.pumpkinLabel',
  });
  for (let index = 0; index < times; index += 1) {
    await userEvent.click(pumpkin);
  }
};

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

  it('stays quiet until the pumpkin has taken the full run of clicks', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    await clickPumpkin(HALLOWEEN_PUMPKIN_CLICKS - 1);

    expect(celebrate).not.toHaveBeenCalled();
  });

  it('wakes the ghost on the last click and starts the count over', async () => {
    mockHalloween(true);
    render(<HalloweenDecor />);
    await clickPumpkin(HALLOWEEN_PUMPKIN_CLICKS);

    expect(celebrate).toHaveBeenCalledExactlyOnceWith(HalloweenBurst.Ghost);

    await clickPumpkin(HALLOWEEN_PUMPKIN_CLICKS);
    expect(celebrate).toHaveBeenCalledTimes(2);
  });
});
