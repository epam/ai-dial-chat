import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCelebrationEvent } from '../../celebrations/registry';
import type { CelebrationEvent } from '../../types/celebration';
import { UserConfigStatus } from '../../types/user-config-status';
import { useAppConfig } from '../AppConfigContext';
import { CelebrationProvider, useCelebration } from '../CelebrationContext';
import { useNotification } from '../NotificationContext';

vi.mock('../../celebrations/registry', () => ({
  loadCelebrationEvent: vi.fn(),
}));
vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));

const mockLoadEvent = vi.mocked(loadCelebrationEvent);
const mockUseAppConfig = vi.mocked(useAppConfig);
const showSuccessNotification = vi.fn();
let consumed: boolean | null = null;

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
      notificationKey: 'halloween.ghostToastMessage',
    },
    {
      id: 'long',
      Component: () => <span data-testid="long-scene" />,
      durationMs: 900,
      notificationKey: 'halloween.webToastMessage',
    },
  ],
  clickSceneIds: ['short', 'long'],
  notificationTitleKey: 'halloween.toastTitle',
  ...overrides,
});

const Triggers = () => {
  const { event, isEnabled, activate, celebrate, consumeSecretPhrase } =
    useCelebration();
  return (
    <>
      <p>Chat remains usable</p>
      <span data-testid="selected-event">{event?.id ?? 'none'}</span>
      <span data-testid="event-enabled">{String(isEnabled)}</span>
      <Link to="/conversations/existing">open conversation</Link>
      <Link to="/">back to start</Link>
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

const setConfig = (
  activeEventId: string | null,
  status = UserConfigStatus.Ready,
) => {
  mockUseAppConfig.mockReturnValue({
    status,
    features: {},
    config: { activeEventId },
  } as ReturnType<typeof useAppConfig>);
};

const Harness = ({ path = '/' }: { path?: string }) => (
  <MemoryRouter initialEntries={[path]}>
    <CelebrationProvider>
      <Triggers />
    </CelebrationProvider>
  </MemoryRouter>
);

const expectEventLoaded = async (id = 'test-event') => {
  await waitFor(() =>
    expect(screen.getByTestId('selected-event').textContent).toBe(id),
  );
};

const deferredEvent = () => {
  let resolve!: (event: CelebrationEvent | null) => void;
  const promise = new Promise<CelebrationEvent | null>((done) => {
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
    vi.mocked(useNotification).mockReturnValue({
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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    UserConfigStatus.Idle,
    UserConfigStatus.Loading,
    UserConfigStatus.Error,
  ])('does not import an event before config is ready (%s)', (status) => {
    setConfig('test-event', status);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(mockLoadEvent).not.toHaveBeenCalled();
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    expect(consumed).toBe(false);
    expect(showSuccessNotification).not.toHaveBeenCalled();
  });

  it.each(['/conversations/existing', '/catalog', '/apps-editor'])(
    'does not import a decorative module on %s',
    (path) => {
      render(<Harness path={path} />);
      expect(mockLoadEvent).not.toHaveBeenCalled();
      expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    },
  );

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

  it('ignores an unknown configured event', async () => {
    mockLoadEvent.mockResolvedValue(null);
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
    fireEvent.click(screen.getByRole('link', { name: 'open conversation' }));
    await act(async () => loading.resolve(makeEvent()));
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(false);
    fireEvent.click(screen.getByRole('link', { name: 'back to start' }));
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
          sceneId: 'long',
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

  it('does not swallow a secret message if its scene is unavailable', async () => {
    mockLoadEvent.mockResolvedValue(
      makeEvent({
        secretTrigger: {
          phrases: ['magic please'],
          hintPhrase: 'magic please',
          sceneId: 'missing',
        },
      }),
    );
    render(<Harness />);
    await expectEventLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(consumed).toBe(false);
    expect(showSuccessNotification).not.toHaveBeenCalled();
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

  it('is inert when the optional provider is absent', () => {
    render(
      <MemoryRouter>
        <Triggers />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'short' }));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));
    expect(screen.getByTestId('event-enabled').textContent).toBe('false');
    expect(consumed).toBe(false);
    expect(showSuccessNotification).not.toHaveBeenCalled();
  });
});
