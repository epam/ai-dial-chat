import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  animateCelebrationSnapshots,
  prepareCelebrationSnapshots,
  type CelebrationSnapshotTarget,
} from '../celebration-snapshots';

const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const recorded: {
  element: Element;
  keyframes: Keyframe[];
  animation: { cancel: ReturnType<typeof vi.fn>; startTime: number | null };
}[] = [];
const onStop = vi.fn();
let fixture: HTMLElement;
let layer: HTMLElement;
let button: HTMLButtonElement;

const targets = (): CelebrationSnapshotTarget[] => [
  { element: button, rect: new DOMRect(10, 20, 80, 32) },
];

const options = {
  durationMs: 1000,
  hideAt: 0.3,
  restoreAt: 0.9,
  frames: () => [{ opacity: 1 }, { opacity: 0 }],
  onStop,
};

const animationsOn = (element: Element) =>
  recorded.filter((entry) => entry.element === element);

describe('prepareCelebrationSnapshots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    recorded.length = 0;
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value(this: Element, keyframes: Keyframe[]) {
        const animation = { cancel: vi.fn(), startTime: null };
        recorded.push({ element: this, keyframes, animation });
        return animation;
      },
    });
    fixture = document.createElement('section');
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'send';
    button.textContent = 'Send';
    fixture.appendChild(button);
    document.body.appendChild(fixture);
    layer = document.createElement('div');
    document.body.appendChild(layer);
  });

  afterEach(() => {
    fixture.remove();
    layer.remove();
    vi.useRealTimers();
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  });

  it('attaches invisible, inert copies without animating the original', () => {
    const session = prepareCelebrationSnapshots(targets(), options);
    session.attach(layer);

    const copy = layer.firstElementChild as HTMLElement;
    expect(copy.style.opacity).toBe('0');
    expect(copy.inert).toBe(true);
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    expect(copy.querySelector('#send')).toBeNull();
    expect(recorded).toHaveLength(0);
  });

  it('lets a decorator move each copy after it is attached', () => {
    const slot = document.createElement('div');
    layer.appendChild(slot);
    const session = prepareCelebrationSnapshots(targets(), {
      ...options,
      decorateCopy: (copy) => slot.appendChild(copy),
    });
    session.attach(layer);

    expect(slot.children).toHaveLength(1);
    session.stop();
    expect(slot.children).toHaveLength(0);
  });

  it('removes only the copies when stopped before start', () => {
    const session = prepareCelebrationSnapshots(targets(), options);
    session.attach(layer);
    session.stop();
    session.start(1234);

    expect(layer.children).toHaveLength(0);
    expect(recorded).toHaveLength(0);
    expect(onStop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts every copy and original once on the given start time', () => {
    const session = prepareCelebrationSnapshots(targets(), options);
    session.attach(layer);
    session.start(1234);
    session.start(5678);

    const copy = layer.firstElementChild as HTMLElement;
    expect(copy.style.opacity).toBe('');
    expect(animationsOn(copy)).toHaveLength(1);
    expect(animationsOn(button)).toHaveLength(1);
    recorded.forEach(({ animation }) => expect(animation.startTime).toBe(1234));
  });

  it('cancels each animation once and releases its timer when stopped after start', () => {
    const session = prepareCelebrationSnapshots(targets(), options);
    session.attach(layer);
    session.start();
    session.stop();
    session.stop();
    document.dispatchEvent(new Event('pointerdown'));

    expect(layer.children).toHaveLength(0);
    recorded.forEach(({ animation }) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
    expect(onStop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fades each original back in over the default share after the restore', () => {
    const session = prepareCelebrationSnapshots(targets(), options);
    session.attach(layer);
    session.start();

    const offsets = animationsOn(button)[0].keyframes.map(
      ({ offset }) => offset,
    );
    [0, 0.29, 0.3, 0.9, 0.94, 1].forEach((expected, index) =>
      expect(offsets[index]).toBeCloseTo(expected, 9),
    );
  });

  it('fades each original back in over the given restore share', () => {
    const session = prepareCelebrationSnapshots(targets(), {
      ...options,
      restoreShare: 0.05,
    });
    session.attach(layer);
    session.start();

    const offsets = animationsOn(button)[0].keyframes.map(
      ({ offset }) => offset,
    );
    expect(offsets[4]).toBeCloseTo(0.95, 9);
  });

  it('carries each copy on a travel layer that starts on the same clock and leaves with it', () => {
    const travelFrames = vi.fn(() => [
      { transform: 'translate(0px, 0px)' },
      { transform: 'translate(120px, 0px)' },
    ]);
    const session = prepareCelebrationSnapshots(targets(), {
      ...options,
      travelFrames,
    });
    session.attach(layer);
    const travel = layer.firstElementChild as HTMLElement;
    const copy = travel.firstElementChild as HTMLElement;

    expect(travel.inert).toBe(true);
    expect(travel.getAttribute('aria-hidden')).toBe('true');
    expect(travel.style.width).toBe('0px');
    expect(copy.dataset.celebrationSnapshot).toBe('true');

    session.start(1234);
    expect(travelFrames).toHaveBeenCalledWith(0);
    expect(animationsOn(travel)).toHaveLength(1);
    expect(animationsOn(travel)[0].keyframes.at(-1)).toEqual({
      transform: 'translate(120px, 0px)',
    });
    recorded.forEach(({ animation }) => expect(animation.startTime).toBe(1234));

    session.stop();
    expect(layer.children).toHaveLength(0);
  });

  it('refuses to start copies that were never attached', () => {
    const session = prepareCelebrationSnapshots(targets(), options);

    expect(() => session.start()).toThrow('Snapshots are not attached');
    expect(recorded).toHaveLength(0);
  });

  it('throws during preparation when a target exceeds the node budget', () => {
    button.innerHTML = '<span></span>'.repeat(1501);

    expect(() => prepareCelebrationSnapshots(targets(), options)).toThrow(
      'node budget',
    );
    expect(layer.children).toHaveLength(0);
    expect(recorded).toHaveLength(0);
  });
});

describe('animateCelebrationSnapshots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    recorded.length = 0;
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value(this: Element, keyframes: Keyframe[]) {
        const animation = { cancel: vi.fn(), startTime: null };
        recorded.push({ element: this, keyframes, animation });
        return animation;
      },
    });
    fixture = document.createElement('section');
    button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Send';
    fixture.appendChild(button);
    document.body.appendChild(fixture);
    layer = document.createElement('div');
    document.body.appendChild(layer);
  });

  afterEach(() => {
    fixture.remove();
    layer.remove();
    vi.useRealTimers();
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  });

  it('prepares, attaches and starts in one call', () => {
    const stop = animateCelebrationSnapshots(targets(), layer, {
      ...options,
      startTime: 99,
    });

    expect(layer.children).toHaveLength(1);
    expect(recorded).toHaveLength(2);
    recorded.forEach(({ animation }) => expect(animation.startTime).toBe(99));
    stop();
    expect(layer.children).toHaveLength(0);
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('reports a stop and leaves the page untouched when a snapshot is too large', () => {
    button.innerHTML = '<span></span>'.repeat(1501);

    const stop = animateCelebrationSnapshots(targets(), layer, options);
    stop();

    expect(layer.children).toHaveLength(0);
    expect(recorded).toHaveLength(0);
    expect(onStop).toHaveBeenCalledOnce();
  });
});
