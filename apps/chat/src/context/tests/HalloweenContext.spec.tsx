import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { Link, MemoryRouter } from 'react-router';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_FEATURE_FLAG,
  HALLOWEEN_WEB_COUNT,
  HALLOWEEN_BAT_COUNT,
  HALLOWEEN_WITCH_COUNT,
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_SECRET_PHRASE,
  HALLOWEEN_SPIDER_COUNT,
} from '../../constants/halloween';
import en from '../../i18n/locales/en.json';
import { HalloweenBurst } from '../../types/halloween';
import { useFeatureFlag } from '../AppConfigContext';
import { HalloweenProvider, useHalloween } from '../HalloweenContext';
import { useNotification } from '../NotificationContext';

vi.mock('../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));

/* The global `react-i18next` mock in `test-setup` is a plain function, so it
   records nothing. This spec needs the interpolation arguments, and keeps the
   same key-as-output behaviour every assertion below relies on. */
const { mockT } = vi.hoisted(() => ({
  mockT: vi.fn((key: string, _params?: Record<string, string>) => key),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseNotification = vi.mocked(useNotification);
const showSuccessNotification = vi.fn();

let lastConsumeResult: boolean | null = null;

/*
 * The flock is decorative inline SVG with no accessible name, so no Testing
 * Library query can reach it — count the drawings inside the celebration
 * layer directly.
 */
const queryDrawings = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelectorAll('[aria-hidden="true"] svg');

/*
 * Only one kind is on screen at a time — the overlay renders a flock or a
 * drop, never both — so the burst under test is what names the result.
 */
const queryGhosts = queryDrawings;
const querySpiders = queryDrawings;

const Triggers: FC = () => {
  const { isEnabled, celebrate, consumeSecretPhrase } = useHalloween();

  return (
    <>
      <Link to="/conversations/existing">open conversation</Link>
      <Link to="/apps-editor">open editor</Link>
      <Link to="/">back to start</Link>
      <button type="button" onClick={() => celebrate(HalloweenBurst.Web)}>
        weave webs
      </button>
      <button type="button" onClick={() => celebrate(HalloweenBurst.Bats)}>
        bats
      </button>
      <button type="button" onClick={() => celebrate(HalloweenBurst.Cat)}>
        cat
      </button>
      <button type="button" onClick={() => celebrate(HalloweenBurst.Witches)}>
        witches
      </button>
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

const renderProvider = (isEnabled: boolean, path = '/') => {
  mockUseFeatureFlag.mockImplementation(
    (key) => key === HALLOWEEN_FEATURE_FLAG && isEnabled,
  );
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HalloweenProvider>
        <Triggers />
      </HalloweenProvider>
    </MemoryRouter>,
  );
};

describe('HalloweenContext', () => {
  afterEach(() => vi.useRealTimers());
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

  it.each(['/conversations/existing', '/apps-editor', '/catalog'])(
    'does not intercept messages or celebrate on %s',
    async (path) => {
      renderProvider(true, path);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));
      await userEvent.click(
        screen.getByRole('button', { name: 'wake the ghosts' }),
      );
      expect(screen.getByTestId('enabled').textContent).toBe('false');
      expect(lastConsumeResult).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(queryDrawings()).toHaveLength(0);
    },
  );

  it('removes an active effect on navigation and does not resume it on return', async () => {
    renderProvider(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    await waitFor(() =>
      expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
    );
    await userEvent.click(
      screen.getByRole('link', { name: 'open conversation' }),
    );
    expect(queryDrawings()).toHaveLength(0);
    await userEvent.click(screen.getByRole('link', { name: 'back to start' }));
    expect(screen.getByTestId('enabled').textContent).toBe('true');
    expect(queryDrawings()).toHaveLength(0);
  });

  it('clears an active celebration when the feature flag turns off', async () => {
    const { rerender } = renderProvider(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    await waitFor(() =>
      expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
    );
    mockUseFeatureFlag.mockReturnValue(false);
    rerender(
      <MemoryRouter>
        <HalloweenProvider>
          <Triggers />
        </HalloweenProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('enabled').textContent).toBe('false');
    expect(queryDrawings()).toHaveLength(0);
  });

  it('replaces ghosts with weaving across a viewport portal', async () => {
    renderProvider(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    await waitFor(() =>
      expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
    );
    await userEvent.click(screen.getByRole('button', { name: 'weave webs' }));
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: 'halloween.toastTitle',
      message: 'halloween.webToastMessage',
    });
    /* Decorative SVG has no semantic query. Small patches sit in the body
       portal, including both screen edges where chat history can be shown. */
    // eslint-disable-next-line testing-library/no-node-access
    const patches = document.body.querySelectorAll('div[class*="webPatch"]');
    expect(patches).toHaveLength(HALLOWEEN_WEB_COUNT);
    // eslint-disable-next-line testing-library/no-node-access
    expect(patches[0].parentElement?.parentElement).toBe(document.body);
  });

  it.each([
    ['bats', HALLOWEEN_BAT_COUNT, 'halloween.batsToastMessage'],
    ['witches', HALLOWEEN_WITCH_COUNT, 'halloween.witchesToastMessage'],
    ['cat', 1, 'halloween.catToastMessage'],
  ] as const)(
    'plays and announces the %s scene',
    async (name, count, message) => {
      renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name, exact: true }));
      await waitFor(() => expect(queryDrawings()).toHaveLength(count));
      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'halloween.toastTitle',
        message,
      });
    },
  );

  it('clears the effect after its lifetime, restarting the timer for a new trigger', async () => {
    renderProvider(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    await waitFor(() =>
      expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
    );
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'wake the ghosts' }));
    act(() => vi.advanceTimersByTime(HALLOWEEN_BURST_DURATION_MS - 100));
    fireEvent.click(screen.getByRole('button', { name: 'wake the ghosts' }));
    act(() => vi.advanceTimersByTime(100));
    expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT);
    act(() => vi.advanceTimersByTime(HALLOWEEN_BURST_DURATION_MS));
    expect(queryDrawings()).toHaveLength(0);
  });

  describe('with the halloweenEnabled flag off', () => {
    it('reports itself disabled and lets the secret phrase through', async () => {
      renderProvider(false);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));

      expect(screen.getByTestId('enabled').textContent).toBe('false');
      expect(lastConsumeResult).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(querySpiders()).toHaveLength(0);
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
    it('consumes the secret phrase, drops the spiders, and notifies', async () => {
      renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));

      expect(lastConsumeResult).toBe(true);
      expect(showSuccessNotification).toHaveBeenCalledWith({
        title: 'halloween.toastTitle',
        message: 'halloween.spidersToastMessage',
      });
      await waitFor(() =>
        expect(querySpiders()).toHaveLength(HALLOWEEN_SPIDER_COUNT),
      );
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

    it.each([
      ['wake the ghosts', 'ghostToastMessage'],
      ['weave webs', 'webToastMessage'],
      ['bats', 'batsToastMessage'],
      ['cat', 'catToastMessage'],
      ['witches', 'witchesToastMessage'],
      ['say phrase', 'spidersToastMessage'],
    ] as const)(
      'names the chat secret phrase in every toast: %s',
      async (button, message) => {
        renderProvider(true);
        await userEvent.click(screen.getByRole('button', { name: button }));
        expect(mockT).toHaveBeenCalledWith(`halloween.${message}`, {
          phrase: HALLOWEEN_SECRET_PHRASE,
        });
        expect(en.halloween[message]).toContain('{{phrase}}');
        expect(en.halloween[message]).toContain('start-page chat');
      },
    );

    it('keeps every drawing out of the accessibility tree', async () => {
      renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));
      await waitFor(() =>
        expect(querySpiders()).toHaveLength(HALLOWEEN_SPIDER_COUNT),
      );

      /* Counted without the `aria-hidden` filter this time, so a drawing that
         escaped the hidden layer would show up as a mismatch rather than
         quietly drop out of the query above. */
      // eslint-disable-next-line testing-library/no-node-access
      const everyDrawing = document.body.querySelectorAll('svg');
      expect(everyDrawing).toHaveLength(HALLOWEEN_SPIDER_COUNT);
      everyDrawing.forEach((drawing) =>
        // eslint-disable-next-line testing-library/no-node-access
        expect(drawing.closest('[aria-hidden="true"]')).not.toBeNull(),
      );
    });
  });
});
