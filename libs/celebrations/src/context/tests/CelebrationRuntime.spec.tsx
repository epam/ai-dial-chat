import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELEBRATIONS_CLASS } from '../../constants/public-class-names';
import type { CelebrationEvent } from '../../models/celebration';
import { CelebrationProvider, useCelebration } from '../CelebrationContext';

const mockLoadEvent = vi.fn<(id: string) => Promise<CelebrationEvent>>();
const showSuccessNotification = vi.fn();
let consumed: boolean | null = null;
/* What the host would pass as `activeEventId` while on its start page. */
let configuredEventId: string | null = 'test-event';

/* Label ids double as their text, so assertions read like the old i18n keys. */
const LABEL_IDS = [
  'halloween.toastTitle',
  'halloween.ghostToastMessage',
  'halloween.webToastMessage',
];

const makeEvent = (
  overrides: Partial<CelebrationEvent> = {},
): CelebrationEvent => ({
  id: 'test-event',
  Decoration: () => null,
  scenes: [
    {
      id: 'short',
      Component: () => <span data-testid="short-scene" />,
      durationMs: 200,
      labelId: 'halloween.ghostToastMessage',
    },
    {
      id: 'long',
      Component: () => <span data-testid="long-scene" />,
      durationMs: 900,
      labelId: 'halloween.webToastMessage',
    },
  ],
  clickSceneIds: ['short', 'long'],
  labels: Object.fromEntries(LABEL_IDS.map((id) => [id, id])),
  titleLabelId: 'halloween.toastTitle',
  ...overrides,
});

const events = {
  'test-event': () => mockLoadEvent('test-event'),
  'second-event': () => mockLoadEvent('second-event'),
};

const Triggers = () => {
  const { event, isEnabled, activate, celebrate, consumeSecretPhrase } =
    useCelebration();
  return (
    <>
      <p>Chat remains usable</p>
      <span data-testid="selected-event">{event?.id ?? 'none'}</span>
      <span data-testid="event-enabled">{String(isEnabled)}</span>
      <button type="button" onClick={activate}>
        activate
      </button>
      <button type="button" onClick={() => celebrate('short')}>
        short
      </button>
      <button type="button" onClick={() => celebrate('long')}>
        long
      </button>
      <button type="button" onClick={() => celebrate('missing')}>
        unknown
      </button>
      <button
        type="button"
        onClick={() => {
          consumed = consumeSecretPhrase('Magic, please!');
        }}
      >
        secret
      </button>
    </>
  );
};

/* Stands in for a host: leaving the start page withholds the event id and
   every navigation changes the reset key. */
const Harness = ({
  labels,
}: {
  labels?: Record<string, Record<string, string | undefined>>;
}) => {
  const [isOnStartPage, setIsOnStartPage] = useState(true);
  const [navigationKey, setNavigationKey] = useState(0);
  const navigate = (toStartPage: boolean) => {
    setIsOnStartPage(toStartPage);
    setNavigationKey((key) => key + 1);
  };
  return (
    <CelebrationProvider
      events={events}
      activeEventId={isOnStartPage ? configuredEventId : null}
      resetKey={navigationKey}
      labels={labels}
      onNotify={showSuccessNotification}
    >
      <button type="button" onClick={() => navigate(false)}>
        open conversation
      </button>
      <button type="button" onClick={() => navigate(true)}>
        back to start
      </button>
      <Triggers />
    </CelebrationProvider>
  );
};

const setConfig = (activeEventId: string | null) => {
  configuredEventId = activeEventId;
};

const expectEventLoaded = async (id = 'test-event') => {
  await waitFor(() =>
    expect(screen.getByTestId('selected-event').textContent).toBe(id),
  );
};

const deferredEvent = () => {
  let resolve!: (event: CelebrationEvent) => void;
  const promise = new Promise<CelebrationEvent>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('Celebration runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumed = null;
    mockLoadEvent.mockReset().mockResolvedValue(makeEvent());
    setConfig('test-event');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not load an event while the host passes no event id', () => {
    setConfig(null);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(mockLoadEvent).not.toHaveBeenCalled();
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    expect(consumed).toBe(false);
    expect(showSuccessNotification).not.toHaveBeenCalled();
  });

  it('keeps ordinary chat usable while a module loads and after its load fails', async () => {
    mockLoadEvent.mockRejectedValue(new Error('Chunk unavailable'));
    render(<Harness />);
    await act(async () => undefined);
    expect(screen.getByText('Chat remains usable')).toBeTruthy();
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(false);
    expect(showSuccessNotification).not.toHaveBeenCalled();
  });

  it('ignores an event id with no loader', async () => {
    setConfig('unknown-event');
    render(<Harness />);
    await act(async () => undefined);
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    expect(showSuccessNotification).not.toHaveBeenCalled();
  });

  it('ignores a loaded module whose identity does not match configuration', async () => {
    mockLoadEvent.mockResolvedValue(makeEvent({ id: 'different-event' }));
    render(<Harness />);
    await act(async () => undefined);
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
  });

  it('discards an old module that resolves after a different event was selected', async () => {
    const oldLoad = deferredEvent();
    mockLoadEvent
      .mockReturnValueOnce(oldLoad.promise)
      .mockResolvedValue(makeEvent({ id: 'second-event' }));
    const { rerender } = render(<Harness />);
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    setConfig('second-event');
    rerender(<Harness />);
    await expectEventLoaded('second-event');
    await act(async () => oldLoad.resolve(makeEvent()));
    expect(screen.getByTestId('selected-event').textContent).toBe(
      'second-event',
    );
  });

  it('discards a pending module when the user leaves the start page', async () => {
    const loading = deferredEvent();
    mockLoadEvent.mockReturnValueOnce(loading.promise);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'open conversation' }));
    await act(async () => loading.resolve(makeEvent()));
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'back to start' }));
    await expectEventLoaded();
    expect(mockLoadEvent).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('short-scene')).toBeNull();
  });

  it('removes the old scene immediately when the configured event changes', async () => {
    const { rerender } = render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'long' }));
    expect(screen.getByTestId('long-scene')).toBeTruthy();
    const nextLoad = deferredEvent();
    mockLoadEvent.mockReturnValueOnce(nextLoad.promise);
    setConfig('second-event');
    rerender(<Harness />);
    expect(screen.queryByTestId('long-scene')).toBeNull();
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    await act(async () => nextLoad.resolve(makeEvent({ id: 'second-event' })));
    expect(screen.getByTestId('selected-event').textContent).toBe(
      'second-event',
    );
    expect(screen.queryByTestId('long-scene')).toBeNull();
  });

  it('uses each scene deadline and cancels the timer of a replaced scene', async () => {
    render(<Harness />);
    await expectEventLoaded();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'short' }));
    act(() => vi.advanceTimersByTime(199));
    expect(screen.getByTestId('short-scene')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('short-scene')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'short' }));
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: 'long' }));
    expect(screen.queryByTestId('short-scene')).toBeNull();
    act(() => vi.advanceTimersByTime(899));
    expect(screen.getByTestId('long-scene')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('long-scene')).toBeNull();
  });

  it('chooses configured click scenes without consecutive repeats', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<Harness />);
    await expectEventLoaded();
    for (let click = 0; click < 6; click++) {
      fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    }
    expect(
      showSuccessNotification.mock.calls.map(
        ([notification]) => notification.message,
      ),
    ).toEqual([
      'halloween.ghostToastMessage',
      'halloween.webToastMessage',
      'halloween.ghostToastMessage',
      'halloween.webToastMessage',
      'halloween.ghostToastMessage',
      'halloween.webToastMessage',
    ]);
  });

  it('supports a single click scene and skips missing scene references', async () => {
    mockLoadEvent.mockResolvedValue(
      makeEvent({ clickSceneIds: ['missing', 'long'] }),
    );
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    expect(showSuccessNotification).toHaveBeenCalledTimes(2);
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: 'halloween.toastTitle',
      message: 'halloween.webToastMessage',
    });
  });

  it.each([{ clickSceneIds: [] }, { clickSceneIds: ['missing'] }])(
    'allows an event with an empty valid click pool ($clickSceneIds)',
    async ({ clickSceneIds }) => {
      mockLoadEvent.mockResolvedValue(makeEvent({ clickSceneIds }));
      render(<Harness />);
      await expectEventLoaded();
      fireEvent.click(screen.getByRole('button', { name: 'activate' }));
      fireEvent.click(screen.getByRole('button', { name: 'unknown' }));
      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(screen.queryByTestId('short-scene')).toBeNull();
    },
  );

  it('leaves chat messages untouched when the event has no secret trigger', async () => {
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(false);
    expect(showSuccessNotification).not.toHaveBeenCalled();
  });

  it('consumes an event-defined phrase without adding its scene to the click pool', async () => {
    mockLoadEvent.mockResolvedValue(
      makeEvent({
        clickSceneIds: ['short'],
        secretTrigger: {
          phrases: ['magic please'],
          hintPhrase: 'magic please',
          sceneIds: ['long'],
        },
      }),
    );
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(true);
    expect(screen.getByTestId('long-scene')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    expect(screen.getByTestId('short-scene')).toBeTruthy();
    expect(screen.queryByTestId('long-scene')).toBeNull();
  });

  it.each([{ sceneIds: [] }, { sceneIds: ['missing'] }])(
    'does not swallow a secret message with no playable scene ($sceneIds)',
    async ({ sceneIds }) => {
      mockLoadEvent.mockResolvedValue(
        makeEvent({
          secretTrigger: {
            phrases: ['magic please'],
            hintPhrase: 'magic please',
            sceneIds,
          },
        }),
      );
      render(<Harness />);
      await expectEventLoaded();
      fireEvent.click(screen.getByRole('button', { name: 'secret' }));
      expect(consumed).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
    },
  );

  const secretEvent = () =>
    makeEvent({
      secretTrigger: {
        phrases: ['magic please'],
        hintPhrase: 'magic please',
        sceneIds: ['missing', 'short', 'short', 'long'],
      },
    });

  it('selects different secret scenes despite intervening clicks', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockLoadEvent.mockResolvedValue(secretEvent());
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(true);
    expect(screen.getByTestId('short-scene')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'long' }));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(true);
    expect(screen.getByTestId('long-scene')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(screen.getByTestId('short-scene')).toBeTruthy();
    expect(showSuccessNotification).toHaveBeenCalledTimes(4);
  });

  it('can select the last valid secret scene on the first message', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    mockLoadEvent.mockResolvedValue(secretEvent());
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(screen.getByTestId('long-scene')).toBeTruthy();
  });

  it('restarts a singleton secret scene and replaces its cleanup deadline', async () => {
    const event = secretEvent();
    if (event.secretTrigger)
      event.secretTrigger.sceneIds = ['missing', 'short', 'short'];
    mockLoadEvent.mockResolvedValue(event);
    render(<Harness />);
    await expectEventLoaded();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    const first = screen.getByTestId('short-scene');
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(true);
    expect(screen.getByTestId('short-scene')).not.toBe(first);
    act(() => vi.advanceTimersByTime(199));
    expect(screen.getByTestId('short-scene')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('short-scene')).toBeNull();
  });

  it('clears secret history on navigation and configured event changes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockLoadEvent.mockResolvedValue(secretEvent());
    const { rerender } = render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(screen.getByTestId('short-scene')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'open conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(false);
    expect(screen.queryByTestId('short-scene')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'back to start' }));
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(screen.getByTestId('short-scene')).toBeTruthy();
    mockLoadEvent.mockResolvedValue({ ...secretEvent(), id: 'second-event' });
    setConfig('second-event');
    rerender(<Harness />);
    await expectEventLoaded('second-event');
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(screen.getByTestId('short-scene')).toBeTruthy();
  });

  it('contains a broken scene and can play a later scene', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const event = makeEvent();
    mockLoadEvent.mockResolvedValue({
      ...event,
      scenes: event.scenes.map((scene) =>
        scene.id === 'short'
          ? {
              ...scene,
              Component: () => {
                throw new Error('Artwork failed');
              },
            }
          : scene,
      ),
    });
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'short' }));
    expect(screen.getByText('Chat remains usable')).toBeTruthy();
    expect(screen.getByTestId('event-enabled').textContent).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'long' }));
    expect(screen.getByTestId('long-scene')).toBeTruthy();
  });

  it('merges host labels over the defaults and fills in the secret phrase', async () => {
    mockLoadEvent.mockResolvedValue(
      makeEvent({
        secretTrigger: {
          phrases: ['magic please'],
          hintPhrase: 'magic please',
          sceneIds: ['long'],
        },
      }),
    );
    render(
      <Harness
        labels={{
          'test-event': {
            'halloween.ghostToastMessage': 'Boo! Say {{phrase}}',
          },
        }}
      />,
    );
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'short' }));
    fireEvent.click(screen.getByRole('button', { name: 'long' }));
    expect(showSuccessNotification.mock.calls).toEqual([
      [{ title: 'halloween.toastTitle', message: 'Boo! Say magic please' }],
      [{ title: 'halloween.toastTitle', message: 'halloween.webToastMessage' }],
    ]);
  });

  it('renders a playing scene in the public scene layer', async () => {
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'short' }));

    expect(
      screen.getByTestId('short-scene').parentElement?.className,
    ).toContain(CELEBRATIONS_CLASS.sceneLayer);
  });

  it('is inert when the optional provider is absent', () => {
    render(<Triggers />);
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'short' }));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    expect(consumed).toBe(false);
    expect(showSuccessNotification).not.toHaveBeenCalled();
  });
});
