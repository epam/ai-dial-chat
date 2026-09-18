import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HALLOWEEN_FEATURE_FLAG,
  HALLOWEEN_GHOST_COUNT,
} from '../../constants/halloween';
import { HalloweenBurst } from '../../types/halloween';
import { useFeatureFlag } from '../AppConfigContext';
import { HalloweenProvider, useHalloween } from '../HalloweenContext';
import { useNotification } from '../NotificationContext';

vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseNotification = vi.mocked(useNotification);
const showSuccessNotification = vi.fn();

let lastConsumeResult: boolean | null = null;

/*
 * The flock is decorative inline SVG with no accessible name, so no Testing
 * Library query can reach it — count the drawings inside the celebration
 * layer directly.
 */
const queryGhosts = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelectorAll('[aria-hidden="true"] svg');

const Triggers: FC = () => {
  const { isEnabled, celebrate, consumeSecretPhrase } = useHalloween();

  return (
    <>
      <span data-testid="enabled">{String(isEnabled)}</span>
      <button
        type="button"
        onClick={() => {
          lastConsumeResult = consumeSecretPhrase('Trick or treat!');
        }}
      >
        say phrase
      </button>
      <button
        type="button"
        onClick={() => {
          lastConsumeResult = consumeSecretPhrase('hello there');
        }}
      >
        say hello
      </button>
      <button type="button" onClick={() => celebrate(HalloweenBurst.Ghost)}>
        wake the ghosts
      </button>
    </>
  );
};

const renderProvider = (isEnabled: boolean) => {
  mockUseFeatureFlag.mockImplementation(
    (key) => key === HALLOWEEN_FEATURE_FLAG && isEnabled,
  );
  return render(
    <HalloweenProvider>
      <Triggers />
    </HalloweenProvider>,
  );
};

describe('HalloweenContext', () => {
  /* The celebration layer is lazily imported by the provider. Resolving the
     module up front keeps the assertions below off the module graph's
     first-load latency, which under a full-suite run outlasts any reasonable
     query timeout. */
  beforeAll(async () => {
    await import('../../components/Halloween/HalloweenBurstOverlay');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    lastConsumeResult = null;
    mockUseNotification.mockReturnValue({
      notifications: [],
      showNotification: vi.fn(),
      showInfoNotification: vi.fn(),
      showSuccessNotification,
      showWarningNotification: vi.fn(),
      showErrorNotification: vi.fn(),
      showLoadingNotification: vi.fn(),
      dismissNotification: vi.fn(),
    });
  });

  describe('with the halloweenEnabled flag off', () => {
    it('reports itself disabled and lets the secret phrase through', async () => {
      renderProvider(false);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));

      expect(screen.getByTestId('enabled').textContent).toBe('false');
      expect(lastConsumeResult).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(screen.queryByText('🎃')).toBeNull();
    });

    it('ignores an explicit celebrate call', async () => {
      renderProvider(false);
      await userEvent.click(
        screen.getByRole('button', { name: 'wake the ghosts' }),
      );

      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(queryGhosts()).toHaveLength(0);
    });
  });

  describe('with the halloweenEnabled flag on', () => {
    it('consumes the secret phrase, rains treats, and notifies', async () => {
      renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));

      expect(lastConsumeResult).toBe(true);
      expect(showSuccessNotification).toHaveBeenCalledWith({
        title: 'halloween.toastTitle',
        message: 'halloween.treatsToastMessage',
      });
      const treats = await screen.findAllByText('🍬');
      expect(treats.length).toBeGreaterThan(0);
    });

    it('leaves an ordinary message alone', async () => {
      renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name: 'say hello' }));

      expect(lastConsumeResult).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
    });

    it('releases a whole flock of ghosts, not one', async () => {
      renderProvider(true);
      await userEvent.click(
        screen.getByRole('button', { name: 'wake the ghosts' }),
      );

      expect(showSuccessNotification).toHaveBeenCalledWith({
        title: 'halloween.toastTitle',
        message: 'halloween.ghostToastMessage',
      });
      await waitFor(() =>
        expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
      );
    });

    it('gives each ghost its own flight path', async () => {
      renderProvider(true);
      await userEvent.click(
        screen.getByRole('button', { name: 'wake the ghosts' }),
      );
      await waitFor(() =>
        expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
      );

      /* Entry points, arcs and pacing are rolled per ghost; identical inline
         styles would mean the flock moves as one body. */
      const paths = Array.from(queryGhosts(), (ghost) =>
        ghost.parentElement?.getAttribute('style'),
      );
      expect(new Set(paths).size).toBe(HALLOWEEN_GHOST_COUNT);
    });

    it('draws more than one kind of ghost', async () => {
      renderProvider(true);
      await userEvent.click(
        screen.getByRole('button', { name: 'wake the ghosts' }),
      );
      await waitFor(() =>
        expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
      );

      const silhouettes = Array.from(queryGhosts(), (ghost) =>
        // eslint-disable-next-line testing-library/no-node-access
        ghost.querySelector('path')?.getAttribute('d'),
      );
      expect(new Set(silhouettes).size).toBeGreaterThan(1);
    });

    it('keeps the celebration layer out of the accessibility tree', async () => {
      renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));

      const [treat] = await screen.findAllByText('🍬');
      /* The `aria-hidden` wrapper is the point of the assertion, and no
         Testing Library query can reach a node *because* it is hidden. */
      // eslint-disable-next-line testing-library/no-node-access
      expect(treat.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });
});
