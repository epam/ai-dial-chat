import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  animateHalloweenTrain,
  buildHalloweenTrainPlan,
  getTrainPumpkin,
  HALLOWEEN_TRAIN_MS,
} from '../halloween-train';

const sourceBounds = new DOMRect(1130, 40, 96, 96);
const trainBounds = new DOMRect(320, 610, 640, 170);

describe('pumpkin train boarding geometry', () => {
  it.each([360, 900, 1280, 1920])(
    'starts at the actual pumpkin and fits the wagon on either side at width %s',
    (width) => {
      const trainWidth = Math.min(640, width - 24);
      const train = new DOMRect(
        (width - trainWidth) / 2,
        570,
        trainWidth,
        (trainWidth * 170) / 640,
      );
      for (const left of [12, width - 108]) {
        const source = new DOMRect(left, 50, 96, 96);
        const plan = buildHalloweenTrainPlan(train, width, source);
        const passenger = plan?.passenger;
        if (!plan || !passenger) throw new Error('Missing boarding plan');
        expect(train.left + passenger.left).toBe(source.left);
        expect(train.top + passenger.top).toBe(source.top);
        expect(passenger.width).toBe(source.width);
        expect(passenger.height).toBe(source.height);
        const unit = train.width / 640;
        const centerX = source.left + source.width / 2 + passenger.dx;
        const centerY = source.top + source.height / 2 + passenger.dy;
        const passengerSize = source.width * passenger.scale;
        const wagonLeft = train.left + (left === 12 ? 61 : 509) * unit;
        expect(centerX - passengerSize / 2).toBeCloseTo(wagonLeft);
        expect(centerX + passengerSize / 2).toBeCloseTo(wagonLeft + 70 * unit);
        expect(centerY - passengerSize / 2).toBeCloseTo(train.top + 49 * unit);
        expect(centerY + passengerSize / 2).toBeCloseTo(train.top + 119 * unit);
        expect(plan.mirrored).toBe(left === 12);
        if (plan.mirrored) {
          expect(train.right + plan.enter).toBeLessThan(0);
          expect(train.left + plan.exit).toBeGreaterThan(width);
        } else {
          expect(train.left + plan.enter).toBeGreaterThan(width);
          expect(train.right + plan.exit).toBeLessThan(0);
        }
      }
    },
  );

  it('can run an empty train when the seasonal pumpkin is unavailable', () => {
    expect(
      buildHalloweenTrainPlan(trainBounds, 1280)?.passenger,
    ).toBeUndefined();
    expect(buildHalloweenTrainPlan(new DOMRect(), 1280)).toBeNull();
  });
});

describe('pumpkin train playback', () => {
  let button: HTMLButtonElement;
  let source: SVGSVGElement;
  let carrier: HTMLDivElement;
  let passenger: HTMLDivElement;
  let stop: (() => void) | undefined;
  const onStop = vi.fn();
  const records: {
    element: Element;
    frames: Keyframe[];
    options: KeyframeAnimationOptions;
    animation: { cancel: ReturnType<typeof vi.fn>; startTime?: number };
  }[] = [];
  const animateDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  );
  const timelineDescriptor = Object.getOwnPropertyDescriptor(
    document,
    'timeline',
  );
  const framesFor = (element: Element) => {
    const record = records.find((record) => record.element === element);
    if (!record) throw new Error('Expected an animation for this actor');
    return record.frames;
  };
  const play = (audioSrc?: string) => {
    const plan = buildHalloweenTrainPlan(trainBounds, 1280, sourceBounds);
    if (!plan) throw new Error('Missing boarding plan');
    stop = animateHalloweenTrain(
      plan,
      { carrier, passenger, source },
      onStop,
      audioSrc,
    );
    return stop;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    onStop.mockClear();
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    button = document.createElement('button');
    button.setAttribute('data-halloween-pumpkin-anchor', '');
    button.setAttribute('aria-label', 'Halloween surprise');
    source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.style.opacity = '0.8';
    button.append(source);
    carrier = document.createElement('div');
    passenger = document.createElement('div');
    carrier.append(passenger);
    document.body.append(button, carrier);
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(sourceBounds);
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      value: { currentTime: 1234 },
    });
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: vi.fn(function (
        this: Element,
        frames: Keyframe[],
        options: KeyframeAnimationOptions,
      ) {
        const animation = { cancel: vi.fn() };
        records.push({ element: this, frames, options, animation });
        return animation;
      }),
    });
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    button.remove();
    carrier.remove();
    records.length = 0;
    if (animateDescriptor)
      Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
    else delete (Element.prototype as Partial<Element>).animate;
    if (timelineDescriptor)
      Object.defineProperty(document, 'timeline', timelineDescriptor);
    else Reflect.deleteProperty(document, 'timeline');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('borrows only a visible pumpkin SVG and leaves its labelled control available', () => {
    button.focus();
    expect(getTrainPumpkin()).toBe(source);
    expect(document.activeElement).toBe(button);
    button.style.display = 'none';
    expect(getTrainPumpkin()).toBeNull();
    button.style.display = '';
    vi.mocked(source.getBoundingClientRect).mockReturnValue(
      new DOMRect(1250, 40, 96, 96),
    );
    expect(getTrainPumpkin()).toBeNull();
    button.remove();
    expect(getTrainPumpkin()).toBeNull();
  });

  it('uses one clock, waits for the landing before departure, and carries the pumpkin in its seat', () => {
    play();
    expect(records).toHaveLength(3);
    records.forEach(({ animation, options }) => {
      expect(animation.startTime).toBe(1234);
      expect(options.duration).toBe(HALLOWEEN_TRAIN_MS);
      expect(options.fill).toBe('both');
    });
    const train = framesFor(carrier);
    const pumpkin = framesFor(passenger);
    const sourceFrames = framesFor(source);
    const stoppedTrain = train.filter(
      (frame) => frame.transform === 'translateX(0px)',
    );
    const arrival = stoppedTrain[0].offset ?? 0;
    const departure = stoppedTrain.at(-1)?.offset ?? 0;
    const visible = pumpkin.find((frame) => frame.opacity === 1);
    expect(visible?.offset).toBeGreaterThan(arrival);
    expect(sourceFrames.find((frame) => frame.opacity === 0)?.offset).toBe(
      visible?.offset,
    );
    const seated = pumpkin.at(-2);
    expect(seated?.offset).toBeLessThan(departure);
    expect(seated?.transform).toBe(pumpkin.at(-1)?.transform);
    expect(seated?.transform).toBe(
      'translate(-314px, 606px) scale(0.7291666666666666) rotate(0deg)',
    );
    const midJump = pumpkin.find(
      (frame) => Math.abs((frame.offset ?? 0) - 0.36) < 0.00001,
    );
    expect(midJump?.transform).toContain('translate(-157px, 175px)');
    expect(sourceFrames.at(-1)?.opacity).toBe(1);
  });

  it.each([
    'pointerdown',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'focusin',
    'scroll',
    'visibilitychange',
    'resize',
    'deadline',
  ])(
    'restores the original SVG and preserves DOM and focus after %s',
    (cause) => {
      button.focus();
      const markup = button.outerHTML;
      const finish = play();
      expect(button.outerHTML).toBe(markup);
      expect(document.activeElement).toBe(button);
      if (cause === 'deadline') vi.advanceTimersByTime(HALLOWEEN_TRAIN_MS);
      else
        (cause === 'resize' ? window : document).dispatchEvent(
          new Event(cause),
        );
      finish();
      expect(onStop).toHaveBeenCalledOnce();
      records.forEach(({ animation }) =>
        expect(animation.cancel).toHaveBeenCalledOnce(),
      );
      expect(button.outerHTML).toBe(markup);
      expect(source.style.opacity).toBe('0.8');
      expect(document.activeElement).toBe(button);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('stops and releases the scene when the source disappears', async () => {
    play();
    button.remove();
    await Promise.resolve();
    expect(onStop).toHaveBeenCalledOnce();
    records.forEach(({ animation }) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
  });

  it('never creates an audio element without a supplied clip', () => {
    const Audio = vi.fn();
    vi.stubGlobal('Audio', Audio);
    play();
    expect(Audio).not.toHaveBeenCalled();
  });

  it('synchronizes smoke and wheels with the journey and cancels them together', () => {
    const decorations = [
      { startTime: 0, cancel: vi.fn() },
      { startTime: 0, cancel: vi.fn() },
    ];
    const getAnimations = vi.fn(() => [...decorations]);
    Object.defineProperty(carrier, 'getAnimations', { value: getAnimations });
    const finish = play();
    expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
    decorations.forEach((animation) => expect(animation.startTime).toBe(1234));
    finish();
    decorations.forEach((animation) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
    records.forEach(({ animation }) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
  });

  it('finishes the visual journey even when audio support cannot be initialized', () => {
    vi.stubGlobal(
      'Audio',
      vi.fn(function () {
        throw new Error('Audio is unavailable');
      }),
    );
    expect(() => play('/sounds/train.mp3')).not.toThrow();
    expect(onStop).not.toHaveBeenCalled();
    records.forEach(({ animation }) =>
      expect(animation.cancel).not.toHaveBeenCalled(),
    );
    vi.advanceTimersByTime(HALLOWEEN_TRAIN_MS);
    expect(onStop).toHaveBeenCalledOnce();
    records.forEach(({ animation }) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
  });

  it('keeps the scene running when optional audio playback is blocked', async () => {
    const audio = {
      play: vi.fn().mockRejectedValue(new Error('Autoplay blocked')),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      volume: 1,
      loop: true,
    };
    const Audio = vi.fn(function () {
      return audio;
    });
    vi.stubGlobal('Audio', Audio);
    const finish = play('/sounds/train.mp3');
    await Promise.resolve();
    expect(Audio).toHaveBeenCalledWith('/sounds/train.mp3');
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.volume).toBe(0.35);
    expect(audio.loop).toBe(false);
    expect(onStop).not.toHaveBeenCalled();
    records.forEach(({ animation }) =>
      expect(animation.cancel).not.toHaveBeenCalled(),
    );
    finish();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(audio.load).toHaveBeenCalledOnce();
  });

  it('cannot resume audio when a pending play resolves after cancellation', async () => {
    let resolvePlay: (() => void) | undefined;
    const pendingPlay = new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
    const audio = {
      play: vi.fn(() => pendingPlay),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
    };
    vi.stubGlobal(
      'Audio',
      vi.fn(function () {
        return audio;
      }),
    );
    const finish = play('/sounds/train.mp3');
    finish();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(audio.load).toHaveBeenCalledOnce();
    resolvePlay?.();
    await Promise.resolve();
    expect(audio.pause).toHaveBeenCalledTimes(2);
    expect(onStop).toHaveBeenCalledOnce();
  });
});
