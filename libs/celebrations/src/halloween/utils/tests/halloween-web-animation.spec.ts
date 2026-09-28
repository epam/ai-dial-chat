import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateHalloweenWeb } from '../halloween-web-animation';
import type { HalloweenWebPlan } from '../halloween-web-plan';

const createContext = () => ({
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  ellipse: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  scale: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  globalAlpha: 1,
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
});

const createPlan = (): HalloweenWebPlan => ({
  width: 320,
  height: 240,
  webs: [
    {
      x: 10,
      y: 20,
      spiderSize: 24,
      delayMs: 200,
      weaveMs: 1000,
      escapeDelayMs: 4000,
      escapeMs: 1000,
      escape: { x: -40, y: 20 },
      spokes: [
        [
          { x: 10, y: 20 },
          { x: 30, y: 20 },
        ],
      ],
      silk: [
        { x: 10, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 40 },
      ],
    },
  ],
  strands: [
    {
      points: [
        { x: 100, y: 100 },
        { x: 110, y: 100 },
        { x: 120, y: 100 },
      ],
      delayMs: 0,
      durationMs: 1000,
    },
  ],
});

describe('Halloween web canvas lifecycle', () => {
  let canvas: HTMLCanvasElement;
  let plan: HalloweenWebPlan;
  let dispose: (() => void) | undefined;
  let nextFrame: number;
  let failContextAt: number;
  let hidden: boolean;
  const queue = new Map<number, FrameRequestCallback>();
  const surfaces: HTMLCanvasElement[] = [];
  const contexts = new Map<
    HTMLCanvasElement,
    ReturnType<typeof createContext>
  >();

  const contextAt = (index: number) => {
    const context = contexts.get(surfaces[index]);
    if (!context) throw new Error(`Missing canvas context ${index}`);
    return context;
  };
  const frameAt = (timestamp: number) => {
    const pending = [...queue.values()];
    queue.clear();
    pending.forEach((callback) => callback(timestamp));
  };
  const start = (
    options: { reducedMotion?: boolean; pixelRatio?: number } = {},
  ) => {
    dispose = animateHalloweenWeb(canvas, plan, {
      color: '#ffffff',
      reducedMotion: false,
      ...options,
    });
  };
  const expectReleased = () => {
    expect(queue.size).toBe(0);
    surfaces.forEach((surface) => {
      expect(surface.width).toBe(1);
      expect(surface.height).toBe(1);
    });
  };

  beforeEach(() => {
    nextFrame = 0;
    failContextAt = 0;
    hidden = false;
    queue.clear();
    surfaces.length = 0;
    contexts.clear();
    plan = createPlan();
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        surfaces.push(this);
        if (surfaces.length === failContextAt) return null;
        const context = createContext();
        contexts.set(this, context);
        return context as unknown as CanvasRenderingContext2D;
      },
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const id = ++nextFrame;
        queue.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => queue.delete(id)),
    );
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    canvas.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('caps expensive draws at thirty per second even with a faster RAF clock', () => {
    start();
    for (let timestamp = 0; timestamp <= 1000; timestamp += 8)
      frameAt(timestamp);
    const context = contextAt(0);
    expect(context.clearRect.mock.calls.length).toBeGreaterThanOrEqual(29);
    expect(context.clearRect.mock.calls.length).toBeLessThanOrEqual(31);
    expect(queue.size).toBe(1);
    expect(surfaces).toHaveLength(5);
  });

  it('renders a complete static scene with no scheduled frames for reduced motion', () => {
    start({ reducedMotion: true });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(queue.size).toBe(0);
    expect(contextAt(0).clearRect).toHaveBeenCalledOnce();
    expect(contextAt(1).lineTo).toHaveBeenCalledTimes(5);
    expect(contextAt(0).translate).toHaveBeenLastCalledWith(30, 40);
    expect(contextAt(0).drawImage).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      -12,
      -12,
      24,
      24,
    );
    dispose?.();
    expectReleased();
  });

  it('adds completed silk segments to the cache once instead of rebuilding them each frame', () => {
    start();
    frameAt(0);
    frameAt(2500);
    const silk = contextAt(1);
    expect(silk.lineTo).toHaveBeenCalledTimes(5);
    const completedMoves = silk.moveTo.mock.calls.length;
    const completedLines = silk.lineTo.mock.calls.length;
    const completedStrokes = silk.stroke.mock.calls.length;
    const mainLines = contextAt(0).lineTo.mock.calls.length;
    for (const timestamp of [2600, 2700, 2800, 2900, 3000]) frameAt(timestamp);
    expect(silk.moveTo).toHaveBeenCalledTimes(completedMoves);
    expect(silk.lineTo).toHaveBeenCalledTimes(completedLines);
    expect(silk.stroke).toHaveBeenCalledTimes(completedStrokes);
    expect(contextAt(0).lineTo).toHaveBeenCalledTimes(mainLines);
    expect(contextAt(0).drawImage).toHaveBeenCalledWith(
      surfaces[1],
      0,
      0,
      320,
      240,
    );
  });

  it('keeps the spider exactly at the progressive silk tip, including turns', () => {
    start();
    frameAt(0);
    frameAt(1250);
    const context = contextAt(0);
    expect(context.lineTo).toHaveBeenLastCalledWith(20, 20);
    expect(context.translate).toHaveBeenLastCalledWith(20, 20);
    expect(context.rotate).toHaveBeenLastCalledWith(Math.PI / 2);
    frameAt(1750);
    expect(context.lineTo).toHaveBeenLastCalledWith(30, 30);
    expect(context.translate).toHaveBeenLastCalledWith(30, 30);
    expect(context.rotate).toHaveBeenLastCalledWith(Math.PI);
    expect(context.drawImage).toHaveBeenLastCalledWith(
      expect.any(HTMLCanvasElement),
      -12,
      -12,
      24,
      24,
    );
  });

  it('waits for the spider entrance and moves its escape continuously to the offscreen destination', () => {
    start();
    frameAt(0);
    frameAt(100);
    expect(contextAt(0).translate).not.toHaveBeenCalled();
    frameAt(4000);
    expect(contextAt(0).translate).toHaveBeenLastCalledWith(30, 40);
    frameAt(4500);
    expect(contextAt(0).translate).toHaveBeenLastCalledWith(-5, 30);
    const beforeExit = contextAt(0).translate.mock.calls.length;
    frameAt(5000);
    expect(contextAt(0).translate).toHaveBeenCalledTimes(beforeExit);
  });

  it.each(['dispose', 'resize', 'scroll', 'visibility', 'contextlost'])(
    'releases every bitmap and prevents stale frames after %s',
    (reason) => {
      start();
      frameAt(0);
      const staleFrame = [...queue.values()][0];
      const drawCount = contextAt(0).clearRect.mock.calls.length;
      if (reason === 'dispose') dispose?.();
      else if (reason === 'visibility') {
        hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      } else if (reason === 'contextlost')
        canvas.dispatchEvent(new Event(reason));
      else if (reason === 'scroll') canvas.dispatchEvent(new Event(reason));
      else window.dispatchEvent(new Event(reason));
      expectReleased();
      staleFrame(200);
      expect(contextAt(0).clearRect).toHaveBeenCalledTimes(drawCount);
      expect(queue.size).toBe(0);
      expect(cancelAnimationFrame).toHaveBeenCalledOnce();
      dispose?.();
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('visibilitychange'));
      expect(cancelAnimationFrame).toHaveBeenCalledOnce();
    },
  );

  it('keeps animating when a visibility event leaves the page visible', () => {
    start();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(queue.size).toBe(1);
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it('does not schedule or draw a scene that starts in a hidden document', () => {
    hidden = true;
    start();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(contextAt(0).clearRect).not.toHaveBeenCalled();
    expectReleased();
  });

  it('stops and frees surfaces at the normal scene deadline', () => {
    start();
    frameAt(100);
    frameAt(13700);
    expect(queue.size).toBe(1);
    frameAt(13800);
    expectReleased();
  });

  it.each([
    ['mobile high DPI', 360, 800, 3],
    ['4K high DPI', 3840, 2160, 3],
    ['very wide desktop', 10000, 4000, 2],
    ['standard pixel ratio', 1280, 800, 1],
  ])(
    'bounds pixel allocation and scaling for %s',
    (_, width, height, pixelRatio) => {
      plan.width = Number(width);
      plan.height = Number(height);
      start({ pixelRatio: Number(pixelRatio) });
      for (const surface of surfaces.slice(0, 2)) {
        expect(surface.width * surface.height).toBeLessThanOrEqual(3000000);
        expect(surface.width / plan.width).toBeLessThanOrEqual(1.5);
        expect(surface.height / plan.height).toBeLessThanOrEqual(1.5);
        expect(surface.width).toBeGreaterThan(0);
        expect(surface.height).toBeGreaterThan(0);
      }
      expect(canvas.width).toBe(surfaces[1].width);
      expect(canvas.height).toBe(surfaces[1].height);
    },
  );

  it.each([1, 2])(
    'safely declines rendering when canvas context %i is missing',
    (contextNumber) => {
      failContextAt = contextNumber;
      expect(() => start()).not.toThrow();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(() => dispose?.()).not.toThrow();
      expect(queue.size).toBe(0);
    },
  );

  it('safely declines an empty viewport', () => {
    plan.width = 0;
    start();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(contextAt(0).scale).not.toHaveBeenCalled();
  });
});
