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
import CelebrationDecor from '../../components/CelebrationDecor/CelebrationDecor';
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_SCENE_DURATIONS,
  HALLOWEEN_WEB_COUNT,
  HALLOWEEN_BAT_COUNT,
  HALLOWEEN_WITCH_COUNT,
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_SECRET_PHRASE,
  HALLOWEEN_SPIDER_COUNT,
} from '../../constants/halloween';
import en from '../../i18n/locales/en.json';
import { HalloweenBurst } from '../../types/halloween';
import { UserConfigStatus } from '../../types/user-config-status';
import { animateHalloweenWeb } from '../../utils/halloween-web-animation';
import { useAppConfig } from '../AppConfigContext';
import { CelebrationProvider, useCelebration } from '../CelebrationContext';
import { useNotification } from '../NotificationContext';

vi.mock('../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));

/* jsdom has no canvas backend. Keep the real scene and geometry while
   replacing only the renderer, which has its own drawing/lifecycle tests. */
vi.mock('../../utils/halloween-web-animation', () => ({
  animateHalloweenWeb: vi.fn(),
}));

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

const mockUseAppConfig = vi.mocked(useAppConfig);
const mockUseNotification = vi.mocked(useNotification);
const showSuccessNotification = vi.fn();
const mockAnimateHalloweenWeb = vi.mocked(animateHalloweenWeb);
const stopWebAnimation = vi.fn();

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
  const { isEnabled, celebrate, consumeSecretPhrase } = useCelebration();

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

const setActiveEvent = (activeEventId: string | null) => {
  mockUseAppConfig.mockReturnValue({
    status: UserConfigStatus.Ready,
    features: {},
    config: { activeEventId },
  } as ReturnType<typeof useAppConfig>);
};

const renderProvider = async (isEnabled: boolean, path = '/') => {
  setActiveEvent(isEnabled ? 'halloween' : null);
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <CelebrationProvider>
        <Triggers />
      </CelebrationProvider>
    </MemoryRouter>,
  );
  if (isEnabled && path === '/') {
    await waitFor(() =>
      expect(screen.getByTestId('enabled').textContent).toBe('true'),
    );
  }
  return view;
};

describe('CelebrationContext with the Halloween module', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  /* The celebration layer is lazily imported by the provider. Resolving the
     module up front keeps the assertions below off the module graph's
     first-load latency, which under a full-suite run outlasts any reasonable
     query timeout. */
  beforeAll(async () => {
    await import('../../celebrations/halloween');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAnimateHalloweenWeb.mockReturnValue(stopWebAnimation);
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
      await renderProvider(true, path);
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
    await renderProvider(true);
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
    await waitFor(() =>
      expect(screen.getByTestId('enabled').textContent).toBe('true'),
    );
    expect(queryDrawings()).toHaveLength(0);
  });

  it('clears an active celebration when the configured event is removed', async () => {
    const { rerender } = await renderProvider(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    await waitFor(() =>
      expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
    );
    setActiveEvent(null);
    rerender(
      <MemoryRouter>
        <CelebrationProvider>
          <Triggers />
        </CelebrationProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('enabled').textContent).toBe('false');
    expect(queryDrawings()).toHaveLength(0);
  });

  it('replaces ghosts with weaving across a viewport portal', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    await renderProvider(true);
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
    await waitFor(() =>
      expect(mockAnimateHalloweenWeb).toHaveBeenCalledTimes(1),
    );
    /* The decorative canvas is hidden from accessibility queries. Verify
       the viewport portal and spider population through the real plan. */
    // eslint-disable-next-line testing-library/no-node-access
    const canvases = document.body.querySelectorAll(
      'canvas[data-halloween-scene="web"]',
    );
    expect(canvases).toHaveLength(1);
    const [canvas, plan] = mockAnimateHalloweenWeb.mock.calls[0];
    expect(canvas).toBe(canvases[0]);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(plan).toMatchObject({ width: 1280, height: 800 });
    expect(plan.webs).toHaveLength(HALLOWEEN_WEB_COUNT);
    expect(queryGhosts()).toHaveLength(0);
    // eslint-disable-next-line testing-library/no-node-access
    expect(canvas.parentElement?.parentElement).toBe(document.body);
    expect(stopWebAnimation).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('link', { name: 'open conversation' }),
    );
    expect(canvas.isConnected).toBe(false);
    expect(stopWebAnimation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['bats', HALLOWEEN_BAT_COUNT, 'halloween.batsToastMessage'],
    ['witches', HALLOWEEN_WITCH_COUNT, 'halloween.witchesToastMessage'],
    ['cat', 1, 'halloween.catToastMessage'],
  ] as const)(
    'plays and announces the %s scene',
    async (name, count, message) => {
      await renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name }));
      await waitFor(() => expect(queryDrawings()).toHaveLength(count));
      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'halloween.toastTitle',
        message,
      });
    },
  );

  it('clears the effect after its lifetime, restarting the timer for a new trigger', async () => {
    await renderProvider(true);
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

  describe('without a configured event', () => {
    it('reports itself disabled and lets the secret phrase through', async () => {
      await renderProvider(false);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));

      expect(screen.getByTestId('enabled').textContent).toBe('false');
      expect(lastConsumeResult).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(querySpiders()).toHaveLength(0);
    });

    it('ignores an explicit celebrate call', async () => {
      await renderProvider(false);
      await userEvent.click(
        screen.getByRole('button', { name: 'wake the ghosts' }),
      );

      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(queryGhosts()).toHaveLength(0);
    });
  });

  describe('with Halloween selected', () => {
    it('consumes the secret phrase, drops the spiders, and notifies', async () => {
      await renderProvider(true);
      vi.spyOn(Math, 'random').mockReturnValue(0);
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
      await renderProvider(true);
      await userEvent.click(screen.getByRole('button', { name: 'say hello' }));

      expect(lastConsumeResult).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
    });

    it('releases a whole flock of ghosts, not one', async () => {
      await renderProvider(true);
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
      await renderProvider(true);
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
      await renderProvider(true);
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
        await renderProvider(true);
        if (button === 'say phrase')
          vi.spyOn(Math, 'random').mockReturnValue(0);
        await userEvent.click(screen.getByRole('button', { name: button }));
        expect(mockT).toHaveBeenCalledWith(`halloween.${message}`, {
          phrase: HALLOWEEN_SECRET_PHRASE,
        });
        expect(en.halloween[message]).toContain('{{phrase}}');
        expect(en.halloween[message]).toContain('start-page chat');
      },
    );

    it('keeps every drawing out of the accessibility tree', async () => {
      await renderProvider(true);
      vi.spyOn(Math, 'random').mockReturnValue(0);
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

    it.each([
      [0.25, HalloweenBurst.Cauldron, 'cauldronToastMessage'],
      [0.45, HalloweenBurst.Mimic, 'mimicToastMessage'],
      [0.65, HalloweenBurst.Bowling, 'bowlingToastMessage'],
      [0.85, HalloweenBurst.Mummy, 'mummyToastMessage'],
    ] as const)(
      'discovers the %s secret choice and clears it on time',
      async (random, scene, message) => {
        await renderProvider(true);
        vi.spyOn(Math, 'random').mockReturnValue(random);
        vi.useFakeTimers();
        fireEvent.click(screen.getByRole('button', { name: 'say phrase' }));
        expect(lastConsumeResult).toBe(true);
        expect(showSuccessNotification).toHaveBeenLastCalledWith({
          title: 'halloween.toastTitle',
          message: `halloween.${message}`,
        });
        expect(mockT).toHaveBeenCalledWith(`halloween.${message}`, {
          phrase: HALLOWEEN_SECRET_PHRASE,
        });
        expect(
          // eslint-disable-next-line testing-library/no-node-access
          document.querySelector(`[data-halloween-scene="${scene}"]`),
        ).not.toBeNull();
        act(() =>
          vi.advanceTimersByTime(
            (HALLOWEEN_SCENE_DURATIONS[scene] ?? HALLOWEEN_BURST_DURATION_MS) -
              1,
          ),
        );
        expect(queryDrawings()).toHaveLength(1);
        act(() => vi.advanceTimersByTime(1));
        expect(queryDrawings()).toHaveLength(0);
      },
    );
  });

  it('loads New Year through the same decor slot and consumes only its own phrase', async () => {
    setActiveEvent('new-year');
    const NewYearTriggers: FC = () => {
      const { consumeSecretPhrase } = useCelebration();
      return (
        <>
          <CelebrationDecor />
          <button
            type="button"
            onClick={() => {
              lastConsumeResult = consumeSecretPhrase('Happy New Year!');
            }}
          >
            new year phrase
          </button>
          <button
            type="button"
            onClick={() => {
              lastConsumeResult = consumeSecretPhrase('trick or treat');
            }}
          >
            other event phrase
          </button>
        </>
      );
    };
    render(
      <MemoryRouter>
        <CelebrationProvider>
          <NewYearTriggers />
        </CelebrationProvider>
      </MemoryRouter>,
    );
    const gift = await screen.findByRole('button', {
      name: 'newYear.giftLabel',
    });
    expect(
      screen.queryByRole('button', { name: 'halloween.pumpkinLabel' }),
    ).toBeNull();
    await userEvent.click(gift);
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: 'newYear.toastTitle',
      message: expect.stringMatching(
        /^newYear\.(snow|confetti|sleigh)ToastMessage$/,
      ),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'new year phrase' }),
    );
    expect(lastConsumeResult).toBe(true);
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: 'newYear.toastTitle',
      message: 'newYear.confettiToastMessage',
    });
    expect(mockT).toHaveBeenCalledWith('newYear.confettiToastMessage', {
      phrase: 'happy new year',
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'other event phrase' }),
    );
    expect(lastConsumeResult).toBe(false);
  });
});
