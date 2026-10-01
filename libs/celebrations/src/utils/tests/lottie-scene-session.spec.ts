import type { AnimationConfigWithData, AnimationItem } from 'lottie-web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LottieScenePlayback } from '../../models/lottie-scene';
import {
  LottieDataOwnership,
  LottieSceneOutcome,
  LottieSceneSessionState,
} from '../../types/lottie-scene';
import type { LottiePlayer } from '../lottie-player';
import { createLottieSceneSession } from '../lottie-scene-session';

interface FakeAnimation {
  callbacks: Map<string, () => void>;
  isLoaded: boolean;
  animationData: Record<string, unknown>;
  play: ReturnType<typeof vi.fn>;
  setSubframe: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  emit: (name: string) => void;
}

interface Preparation {
  data: Record<string, unknown>;
}

let animations: FakeAnimation[];
let host: HTMLDivElement;
let isLoadedOnCreate: boolean;
let player: LottiePlayer & {
  loadAnimation: ReturnType<
    typeof vi.fn<(options: AnimationConfigWithData<'svg'>) => AnimationItem>
  >;
};

const TIMINGS = { loadTimeoutMs: 2000, readyTimeoutMs: 250, playbackMs: 16000 };
const original = () => ({ layers: [{ ty: 4, nm: 'helper' }], v: '5.13.0' });

beforeEach(() => {
  vi.useFakeTimers();
  animations = [];
  isLoadedOnCreate = true;
  host = document.createElement('div');
  document.body.append(host);
  player = {
    loadAnimation: vi.fn((options: AnimationConfigWithData<'svg'>) => {
      const callbacks = new Map<string, () => void>();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      options.container?.append(svg);
      /* Like lottie_light's completeData, the fake player mutates its input. */
      const data = options.animationData as Record<string, unknown>;
      data.__complete = true;
      (data.layers as unknown[]).length = 0;
      const animation: FakeAnimation = {
        callbacks,
        isLoaded: isLoadedOnCreate,
        animationData: data,
        play: vi.fn(),
        setSubframe: vi.fn(),
        destroy: vi.fn(() => svg.remove()),
        emit: (name) => callbacks.get(name)?.(),
      };
      animations.push(animation);
      return {
        ...animation,
        get isLoaded() {
          return animation.isLoaded;
        },
        addEventListener: (name: string, callback: () => void) =>
          callbacks.set(name, callback),
        removeEventListener: (name: string) => callbacks.delete(name),
      } as unknown as AnimationItem;
    }),
  };
});
afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const createSession = ({
  loadPlayer = vi.fn(async () => player),
  prepare = vi.fn((): Preparation => ({ data: original() })),
  ownership = LottieDataOwnership.Transferred,
  onAnimationCreated,
}: {
  loadPlayer?: () => Promise<LottiePlayer>;
  prepare?: () => Preparation;
  ownership?: LottieDataOwnership;
  onAnimationCreated?: LottieScenePlayback<Preparation>['onAnimationCreated'];
} = {}) => {
  const onPrepared = vi.fn();
  const onTerminal = vi.fn();
  const playback: LottieScenePlayback<Preparation> = {
    timings: TIMINGS,
    ownership,
    getAnimationData: ({ data }) => data,
    onAnimationCreated,
  };
  const session = createLottieSceneSession({
    playback,
    prepare,
    onPrepared,
    onTerminal,
    loadPlayer,
  });
  return { session, onPrepared, onTerminal, loadPlayer, prepare };
};

const deferred = () => {
  let resolve: (value: LottiePlayer) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<LottiePlayer>((complete, abort) => {
    resolve = complete;
    reject = abort;
  });
  return { load: vi.fn(() => promise), resolve, reject };
};

/* Starts, loads, prepares and attaches; the renderer then awaits DOMLoaded. */
const startInitializing = async (
  options?: Parameters<typeof createSession>[0],
) => {
  const created = createSession(options);
  created.session.start();
  await flush();
  created.session.attach(host);
  return created;
};

const expectReleased = () => {
  expect(animations.every((a) => a.destroy.mock.calls.length === 1)).toBe(true);
  expect(animations.every((a) => a.callbacks.size === 0)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
};

describe('createLottieSceneSession', () => {
  it('starts the playback deadline at readiness, not at import or renderer creation', async () => {
    const { onTerminal } = await startInitializing();
    vi.advanceTimersByTime(200);
    animations[0].emit('DOMLoaded');
    expect(animations[0].play).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(15900);
    expect(onTerminal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Completed);
    expectReleased();
  });

  it('fails when the player import exceeds the load deadline and ignores its late resolution', async () => {
    const { load, resolve } = deferred();
    const { session, onTerminal, prepare } = createSession({
      loadPlayer: load,
    });
    session.start();
    await flush();
    vi.advanceTimersByTime(2000);
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Failed);
    resolve(player);
    await flush();
    expect(prepare).not.toHaveBeenCalled();
    expect(player.loadAnimation).not.toHaveBeenCalled();
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails at the readiness deadline when the renderer reports isLoaded without DOMLoaded', async () => {
    const { onTerminal } = await startInitializing();
    vi.advanceTimersByTime(249);
    expect(onTerminal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Failed);
    expect(animations[0].play).not.toHaveBeenCalled();
    expectReleased();
  });

  it('fails immediately when DOMLoaded arrives on an unloaded renderer', async () => {
    isLoadedOnCreate = false;
    const { onTerminal } = await startInitializing();
    animations[0].emit('DOMLoaded');
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Failed);
    expect(animations[0].play).not.toHaveBeenCalled();
    expectReleased();
  });

  it('plays once when DOMLoaded repeats and ignores callbacks after the end', async () => {
    const { session, onTerminal } = await startInitializing();
    const { emit, callbacks } = animations[0];
    const domLoaded = callbacks.get('DOMLoaded');
    emit('DOMLoaded');
    domLoaded?.();
    expect(animations[0].play).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    session.cancel();
    domLoaded?.();
    expect(animations[0].play).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Cancelled);
  });

  it('cancels without importing when disposed before the start microtask', async () => {
    const { session, loadPlayer, onTerminal } = createSession();
    session.start();
    session.dispose();
    await flush();
    expect(loadPlayer).not.toHaveBeenCalled();
    expect(onTerminal).not.toHaveBeenCalled();
    expect(session.state).toBe(LottieSceneSessionState.Cancelled);
  });

  it('cancels without importing when the document is hidden at start', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { session, loadPlayer, onTerminal } = createSession();
    session.start();
    await flush();
    expect(loadPlayer).not.toHaveBeenCalled();
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Cancelled);
  });

  it('cancels without preparing when the document is hidden as the import resolves', async () => {
    const { load, resolve } = deferred();
    const { session, onTerminal, prepare } = createSession({
      loadPlayer: load,
    });
    session.start();
    await flush();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    resolve(player);
    await flush();
    expect(prepare).not.toHaveBeenCalled();
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Cancelled);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    LottieSceneSessionState.Loading,
    LottieSceneSessionState.Prepared,
    LottieSceneSessionState.Initializing,
    LottieSceneSessionState.Playing,
  ])(
    'ends as cancelled when cancelled while %s and never reports failure later',
    async (phase) => {
      const { load, resolve } = deferred();
      const { session, onTerminal } = createSession({ loadPlayer: load });
      session.start();
      await flush();
      if (phase !== LottieSceneSessionState.Loading) {
        resolve(player);
        await flush();
      }
      if (
        phase === LottieSceneSessionState.Initializing ||
        phase === LottieSceneSessionState.Playing
      )
        session.attach(host);
      if (phase === LottieSceneSessionState.Playing)
        animations[0].emit('DOMLoaded');
      expect(session.state).toBe(phase);
      session.cancel();
      resolve(player);
      await flush();
      session.attach(host);
      vi.advanceTimersByTime(20000);
      expect(onTerminal).toHaveBeenCalledOnce();
      expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Cancelled);
      expect(session.state).toBe(LottieSceneSessionState.Cancelled);
      expect(animations.length).toBeLessThanOrEqual(1);
      expectReleased();
      expect(host.childElementCount).toBe(0);
    },
  );

  it('ignores an import that resolves after cancellation: no preparation, no renderer', async () => {
    const { load, resolve } = deferred();
    const { session, prepare, onPrepared } = createSession({
      loadPlayer: load,
    });
    session.start();
    await flush();
    session.cancel();
    resolve(player);
    await flush();
    expect(prepare).not.toHaveBeenCalled();
    expect(onPrepared).not.toHaveBeenCalled();
    expect(player.loadAnimation).not.toHaveBeenCalled();
  });

  it('does not notify after dispose and tolerates repeated cancel and dispose', async () => {
    const { session, onTerminal } = await startInitializing();
    animations[0].emit('DOMLoaded');
    session.dispose();
    session.dispose();
    session.cancel();
    vi.advanceTimersByTime(20000);
    expect(onTerminal).not.toHaveBeenCalled();
    expectReleased();
  });

  it('reports exactly one outcome when completion, the deadline and an interrupt coincide', async () => {
    const { session, onTerminal } = await startInitializing();
    animations[0].emit('DOMLoaded');
    vi.advanceTimersByTime(15999);
    const { emit } = animations[0];
    const complete = animations[0].callbacks.get('complete');
    emit('complete');
    complete?.();
    vi.advanceTimersByTime(1);
    session.cancel();
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Completed);
    expectReleased();
  });

  it('removes renderer nodes and still runs every disposer when destroy throws', async () => {
    const dispose = vi.fn();
    const { onTerminal } = await startInitializing({
      onAnimationCreated: ({ addDisposer }) => addDisposer(dispose),
    });
    animations[0].destroy.mockImplementation(() => {
      throw new Error('Renderer teardown failed');
    });
    animations[0].emit('error');
    expect(dispose).toHaveBeenCalledOnce();
    expect(host.childElementCount).toBe(0);
    expect(animations[0].callbacks.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Failed);
  });

  it('runs the remaining disposers and destroy when one disposer throws', async () => {
    const order: string[] = [];
    const { session } = await startInitializing({
      onAnimationCreated: ({ addDisposer }) => {
        addDisposer(() => order.push('first'));
        addDisposer(() => {
          order.push('second');
          throw new Error('Disconnect failed');
        });
      },
    });
    session.cancel();
    expect(order).toEqual(['second', 'first']);
    expectReleased();
    expect(host.style.visibility).toBe('hidden');
  });

  it.each(['loadAnimation', 'setSubframe', 'play', 'onAnimationCreated'])(
    'fails and releases resources when %s throws',
    async (step) => {
      const load = player.loadAnimation.getMockImplementation();
      if (!load) throw new Error('Missing player fixture');
      player.loadAnimation.mockImplementationOnce((options) => {
        if (step === 'loadAnimation') throw new Error('Renderer unavailable');
        const animation = load(options);
        if (step === 'setSubframe')
          animations[0].setSubframe.mockImplementation(() => {
            throw new Error('Subframe unavailable');
          });
        if (step === 'play')
          animations[0].play.mockImplementation(() => {
            throw new Error('Playback unavailable');
          });
        return {
          ...animation,
          get isLoaded() {
            return animations[0].isLoaded;
          },
          setSubframe: animations[0].setSubframe,
          play: animations[0].play,
          addEventListener: animation.addEventListener,
          removeEventListener: animation.removeEventListener,
          destroy: animations[0].destroy,
        } as unknown as AnimationItem;
      });
      const { onTerminal } = await startInitializing({
        onAnimationCreated:
          step === 'onAnimationCreated'
            ? () => {
                throw new Error('Scene setup failed');
              }
            : undefined,
      });
      if (step === 'play') animations[0].emit('DOMLoaded');
      expect(onTerminal).toHaveBeenCalledOnce();
      expect(onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Failed);
      expectReleased();
      expect(host.childElementCount).toBe(0);
    },
  );

  it.each([
    ['complete', LottieSceneOutcome.Completed],
    ['data_failed', LottieSceneOutcome.Failed],
    ['error', LottieSceneOutcome.Failed],
  ])('maps the %s event to the %s outcome', async (name, outcome) => {
    const { onTerminal } = await startInitializing();
    animations[0].emit('DOMLoaded');
    animations[0].emit(name);
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledWith(outcome);
    expectReleased();
  });

  it('prepares only after the import resolves, exactly once', async () => {
    const { load, resolve } = deferred();
    const { session, prepare, onPrepared } = createSession({
      loadPlayer: load,
    });
    session.start();
    await flush();
    vi.advanceTimersByTime(1900);
    expect(prepare).not.toHaveBeenCalled();
    resolve(player);
    await flush();
    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledWith(player);
    expect(onPrepared).toHaveBeenCalledOnce();
    expect(session.state).toBe(LottieSceneSessionState.Prepared);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clones shared animation data for every playback so a mutating player cannot alter the source', async () => {
    const source = original();
    const shared = () => ({ data: source });
    const first = await startInitializing({
      ownership: LottieDataOwnership.Shared,
      prepare: shared,
    });
    first.session.cancel();
    const second = await startInitializing({
      ownership: LottieDataOwnership.Shared,
      prepare: shared,
    });
    second.session.cancel();
    expect(source).toEqual(original());
    expect(animations).toHaveLength(2);
    expect(animations[0].animationData).not.toBe(source);
    expect(animations[1].animationData).not.toBe(animations[0].animationData);
    expect(player.loadAnimation.mock.calls[1][0].animationData).not.toBe(
      source,
    );
  });

  it('hands transferred data to the player once and ignores a second attach', async () => {
    const data = original();
    const { session } = await startInitializing({ prepare: () => ({ data }) });
    session.attach(host);
    expect(player.loadAnimation).toHaveBeenCalledOnce();
    expect(animations[0].animationData).toBe(data);
  });

  it('lets a later session load after an earlier import was rejected', async () => {
    const loadPlayer = vi
      .fn<() => Promise<LottiePlayer>>()
      .mockRejectedValueOnce(new Error('Chunk failed'))
      .mockResolvedValue(player);
    const first = createSession({ loadPlayer });
    first.session.start();
    await flush();
    expect(first.onTerminal).toHaveBeenCalledWith(LottieSceneOutcome.Failed);
    const second = createSession({ loadPlayer });
    second.session.start();
    await flush();
    second.session.attach(host);
    animations[0].emit('DOMLoaded');
    expect(loadPlayer).toHaveBeenCalledTimes(2);
    expect(animations[0].play).toHaveBeenCalledOnce();
    second.session.dispose();
  });
});
