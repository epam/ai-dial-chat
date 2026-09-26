import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type FC, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CelebrationDecor } from '../../components/CelebrationDecor/CelebrationDecor';
import {
  CelebrationProvider,
  useCelebration,
} from '../../context/CelebrationContext';
import { NEW_YEAR_LABELS } from '../../new-year/constants/labels';
import { newYearEvent } from '../../new-year/event';
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_SCENE_DURATIONS,
  HALLOWEEN_WEB_COUNT,
  HALLOWEEN_BAT_COUNT,
  HALLOWEEN_WITCH_COUNT,
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_SECRET_PHRASE,
  HALLOWEEN_SPIDER_COUNT,
} from '../constants/halloween';
import { HALLOWEEN_LABELS } from '../constants/labels';
import { halloweenEvent } from '../event';
import type { HalloweenLabels } from '../models/labels';
import { HalloweenScene } from '../types/halloween';
import { animateHalloweenWeb } from '../utils/halloween-web-animation';

/* jsdom has no canvas backend. Keep the real scene and geometry while
   replacing only the renderer, which has its own drawing/lifecycle tests. */
vi.mock('../utils/halloween-web-animation', () => ({
  animateHalloweenWeb: vi.fn(),
}));

const showSuccessNotification = vi.fn();
const mockAnimateHalloweenWeb = vi.mocked(animateHalloweenWeb);
const stopWebAnimation = vi.fn();
const TITLE = HALLOWEEN_LABELS.toastTitle;
/** The message a host shows for a scene, with the secret hint filled in. */
const message = (key: keyof HalloweenLabels) =>
  HALLOWEEN_LABELS[key].replace('{{phrase}}', HALLOWEEN_SECRET_PHRASE);

const EVENTS = {
  halloween: async () => halloweenEvent,
  'new-year': async () => newYearEvent,
};

/* Stands in for a host: leaving the start page withholds the event id and
   every navigation changes the reset key. */
let configuredEventId: string | null = 'halloween';
const Host: FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnStartPage, setIsOnStartPage] = useState(true);
  const [navigationKey, setNavigationKey] = useState(0);
  const navigate = (toStartPage: boolean) => {
    setIsOnStartPage(toStartPage);
    setNavigationKey((key) => key + 1);
  };
  return (
    <CelebrationProvider
      events={EVENTS}
      activeEventId={isOnStartPage ? configuredEventId : null}
      resetKey={navigationKey}
      onNotify={showSuccessNotification}
    >
      <button type="button" onClick={() => navigate(false)}>
        open conversation
      </button>
      <button type="button" onClick={() => navigate(true)}>
        back to start
      </button>
      {children}
    </CelebrationProvider>
  );
};

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
      <button type="button" onClick={() => celebrate(HalloweenScene.Web)}>
        weave webs
      </button>
      <button type="button" onClick={() => celebrate(HalloweenScene.Bats)}>
        bats
      </button>
      <button type="button" onClick={() => celebrate(HalloweenScene.Cat)}>
        cat
      </button>
      <button type="button" onClick={() => celebrate(HalloweenScene.Witches)}>
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
      <button type="button" onClick={() => celebrate(HalloweenScene.Ghost)}>
        wake the ghosts
      </button>
    </>
  );
};

const renderProvider = async (isEnabled: boolean) => {
  configuredEventId = isEnabled ? 'halloween' : null;
  const view = render(
    <Host>
      <Triggers />
    </Host>,
  );
  if (isEnabled) {
    await waitFor(() =>
      expect(screen.getByTestId('enabled').textContent).toBe('true'),
    );
  }
  return view;
};

describe('Halloween event through the celebration runtime', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnimateHalloweenWeb.mockReturnValue(stopWebAnimation);
    lastConsumeResult = null;
  });

  it('removes an active effect on navigation and does not resume it on return', async () => {
    await renderProvider(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    await waitFor(() =>
      expect(queryGhosts()).toHaveLength(HALLOWEEN_GHOST_COUNT),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'open conversation' }),
    );
    expect(queryDrawings()).toHaveLength(0);
    await userEvent.click(
      screen.getByRole('button', { name: 'back to start' }),
    );
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
    configuredEventId = null;
    rerender(
      <Host>
        <Triggers />
      </Host>,
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
      title: TITLE,
      message: message('webToastMessage'),
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
      screen.getByRole('button', { name: 'open conversation' }),
    );
    expect(canvas.isConnected).toBe(false);
    expect(stopWebAnimation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['bats', HALLOWEEN_BAT_COUNT, 'batsToastMessage'],
    ['witches', HALLOWEEN_WITCH_COUNT, 'witchesToastMessage'],
    ['cat', 1, 'catToastMessage'],
  ] as const)('plays and announces the %s scene', async (name, count, key) => {
    await renderProvider(true);
    await userEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(queryDrawings()).toHaveLength(count));
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: TITLE,
      message: message(key),
    });
  });

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
        title: TITLE,
        message: message('spidersToastMessage'),
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
        title: TITLE,
        message: message('ghostToastMessage'),
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
      async (button, key) => {
        await renderProvider(true);
        if (button === 'say phrase')
          vi.spyOn(Math, 'random').mockReturnValue(0);
        await userEvent.click(screen.getByRole('button', { name: button }));
        expect(showSuccessNotification).toHaveBeenLastCalledWith({
          title: TITLE,
          message: message(key),
        });
        expect(HALLOWEEN_LABELS[key]).toContain('{{phrase}}');
        expect(HALLOWEEN_LABELS[key]).toContain('start-page chat');
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
      [0.25, HalloweenScene.Cauldron, 'cauldronToastMessage'],
      [0.45, HalloweenScene.Mimic, 'mimicToastMessage'],
      [0.65, HalloweenScene.Bowling, 'bowlingToastMessage'],
      [0.85, HalloweenScene.Mummy, 'mummyToastMessage'],
    ] as const)(
      'discovers the %s secret choice and clears it on time',
      async (random, scene, key) => {
        await renderProvider(true);
        vi.spyOn(Math, 'random').mockReturnValue(random);
        vi.useFakeTimers();
        fireEvent.click(screen.getByRole('button', { name: 'say phrase' }));
        expect(lastConsumeResult).toBe(true);
        expect(showSuccessNotification).toHaveBeenLastCalledWith({
          title: TITLE,
          message: message(key),
        });
        expect(showSuccessNotification).toHaveBeenLastCalledWith({
          title: TITLE,
          message: message(key),
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
    configuredEventId = 'new-year';
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
      <Host>
        <NewYearTriggers />
      </Host>,
    );
    const gift = await screen.findByRole('button', {
      name: NEW_YEAR_LABELS.giftLabel,
    });
    expect(
      screen.queryByRole('button', { name: HALLOWEEN_LABELS.pumpkinLabel }),
    ).toBeNull();
    await userEvent.click(gift);
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: NEW_YEAR_LABELS.toastTitle,
      message: expect.stringContaining('"happy new year"'),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'new year phrase' }),
    );
    expect(lastConsumeResult).toBe(true);
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: NEW_YEAR_LABELS.toastTitle,
      message: NEW_YEAR_LABELS.confettiToastMessage.replace(
        '{{phrase}}',
        'happy new year',
      ),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'other event phrase' }),
    );
    expect(lastConsumeResult).toBe(false);
  });
});
