import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  animateRavens,
  ravenSectionTransform,
} from '../halloween-raven-animation';
import {
  buildRavenPlan,
  RAVEN_SCENE_MS,
  RAVEN_ROW_SECTIONS,
} from '../halloween-raven-plan';
import type { RavenPlan } from '../halloween-raven-plan';
import type { RavenSurface } from '../halloween-raven-targets';

const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const originalTimeline = Object.getOwnPropertyDescriptor(document, 'timeline');
let fixture: HTMLElement;
let host: HTMLElement;
let copies: HTMLElement;
let nest: HTMLElement;
let fallback: HTMLElement;
let row: HTMLElement;
let plan: RavenPlan;
let birds: HTMLElement[];
let stop: (() => void) | undefined;
const onStop = vi.fn();
const recorded: {
  element: Element;
  frames: Keyframe[];
  animation: { cancel: ReturnType<typeof vi.fn>; startTime?: number };
}[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'timeline', {
    configurable: true,
    value: { currentTime: 2345 },
  });
  fixture = document.createElement('section');
  row = document.createElement('li');
  row.innerHTML =
    '<a href="/conversations/a" id="row-link"><span>My existing conversation</span></a>';
  fixture.appendChild(row);
  document.body.appendChild(fixture);
  host = document.createElement('div');
  copies = document.createElement('div');
  nest = document.createElement('div');
  fallback = document.createElement('div');
  nest.innerHTML = '<svg><path data-raven-twig="0"/></svg>';
  host.append(copies, nest, fallback);
  document.body.appendChild(host);
  const surface: RavenSurface = {
    element: row,
    rect: new DOMRect(20, 180, 230, 40),
    color: '#aaa',
    background: '#111',
  };
  plan = buildRavenPlan(
    {
      width: 1280,
      height: 800,
      composer: null,
      pumpkin: null,
      conversation: surface,
      fragments: [],
      edges: [surface],
    },
    false,
  );
  birds = plan.birds.map(() => {
    const element = document.createElement('div');
    element.innerHTML =
      '<div data-raven-orientation><svg><g data-raven-wing="true"/></svg></div><svg data-raven-carried-strip="true"/><div data-raven-fragment-slot></div>';
    host.appendChild(element);
    return element;
  });
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(function (this: Element, frames: Keyframe[]) {
      const animation = { cancel: vi.fn() };
      recorded.push({ element: this, frames, animation });
      return animation;
    }),
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  host.remove();
  fixture.remove();
  recorded.length = 0;
  if (originalAnimate)
    Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  else delete (Element.prototype as Partial<Element>).animate;
  if (originalTimeline)
    Object.defineProperty(document, 'timeline', originalTimeline);
  else Reflect.deleteProperty(document, 'timeline');
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const play = () => {
  stop = animateRavens(plan, { host, copies, birds, nest, fallback }, onStop);
};

describe('raven animation ownership', () => {
  it('keeps SVG references local to each section when IDs have common prefixes', () => {
    row.innerHTML +=
      '<svg><defs><linearGradient id="glow1"/><linearGradient id="glow10"/></defs><rect fill="url(#glow10)"/></svg>';
    play();
    const sections = copies.querySelectorAll('[data-raven-row-section]');
    sections.forEach((section) => {
      const fill = section.querySelector('rect')?.getAttribute('fill');
      const id = fill?.slice(5, -1);
      expect(id).toBeTruthy();
      expect(section.querySelector('[id="' + id + '"]')).not.toBeNull();
    });
  });
  it('borrows one row in five inert visual sections and never moves the original node', () => {
    const before = row.outerHTML;
    play();
    expect(copies.querySelectorAll('[data-celebration-snapshot]')).toHaveLength(
      1,
    );
    expect(copies.querySelectorAll('[data-raven-row-section]')).toHaveLength(
      RAVEN_ROW_SECTIONS,
    );
    const copy = copies.firstElementChild as HTMLElement;
    expect(copy.inert).toBe(true);
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    expect(copies.querySelector('a[href]')).toBeNull();
    const ids = Array.from(
      document.querySelectorAll('[id]'),
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(row.parentElement).toBe(fixture);
    expect(row.outerHTML).toBe(before);
    stop?.();
    expect(copies.children).toHaveLength(0);
    expect(row.outerHTML).toBe(before);
  });

  it('carries a cropped piece at the beak without hiding its whole source', async () => {
    const source = document.createElement('h1');
    source.textContent = 'What can I help with?';
    fixture.append(source);
    const fragment = {
      element: source,
      rect: new DOMRect(400, 100, 300, 48),
      crop: new DOMRect(512, 108, 76, 32),
      color: '#eee',
      background: '#111',
    };
    plan.materials = [
      { ...fragment, x: 512, y: 108, width: 76, height: 32, fragment },
    ];
    Object.assign(plan.birds[2], {
      material: 0,
      pickup: 0.2,
      delivery: 0.4,
      facing: -1,
    });
    plan.anchors.push(source);
    const before = source.outerHTML;
    play();
    const copy = birds[2].querySelector<HTMLElement>('[data-raven-fragment]')!;
    expect(copy).not.toBeNull();
    expect(copy.style.left).toBe('-76px');
    expect(copy.style.width).toBe('76px');
    expect(copy.style.height).toBe('32px');
    expect(copy.inert).toBe(true);
    expect(copy.querySelector('h1')?.style.left).toBe('-112px');
    expect(recorded.some(({ element }) => element === source)).toBe(false);
    expect(source.outerHTML).toBe(before);
    const animation = recorded.find(({ element }) => element === copy)!;
    expect(animation.animation.startTime).toBe(2345);
    expect(animation.frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offset: 0.2, opacity: 1 }),
        expect.objectContaining({ offset: 0.41200000000000003, opacity: 0 }),
      ]),
    );
    source.textContent = 'Changed while flying';
    await Promise.resolve();
    expect(host.querySelectorAll('[data-celebration-snapshot]')).toHaveLength(
      0,
    );
    expect(source.textContent).toBe('Changed while flying');
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('uses a common start time and performs no recurring geometry/style reads', () => {
    const bounds = vi.spyOn(row, 'getBoundingClientRect');
    const computed = vi.spyOn(window, 'getComputedStyle');
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    play();
    expect(
      recorded.every(({ animation }) => animation.startTime === 2345),
    ).toBe(true);
    const reads = computed.mock.calls.length;
    vi.advanceTimersByTime(10000);
    expect(computed).toHaveBeenCalledTimes(reads);
    expect(bounds).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    expect(recorded.length).toBeLessThan(60);
  });

  it.each([
    'pointerdown',
    'keydown',
    'input',
    'focusin',
    'scroll',
    'resize',
    'deadline',
    'unmount',
    'visibilitychange',
  ])('restores the entire scene on %s', (reason) => {
    play();
    if (reason === 'deadline') vi.advanceTimersByTime(RAVEN_SCENE_MS);
    else if (reason === 'unmount') stop?.();
    else {
      if (reason === 'visibilitychange')
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      (reason === 'resize' ? window : document).dispatchEvent(
        new Event(reason),
      );
    }
    expect(copies.children).toHaveLength(0);
    expect(onStop).toHaveBeenCalledOnce();
    recorded.forEach(({ animation }) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
    stop?.();
    expect(onStop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the entire scene if its borrowed target changes', async () => {
    play();
    row.textContent = 'Renamed';
    await Promise.resolve();
    expect(copies.children).toHaveLength(0);
    expect(onStop).toHaveBeenCalledOnce();
    expect(row.textContent).toBe('Renamed');
  });

  it('animates a decorative strip without cloning or hiding the input', () => {
    plan.conversation = null;
    play();
    expect(copies.children).toHaveLength(0);
    expect(fallback.querySelectorAll('[data-raven-row-section]')).toHaveLength(
      5,
    );
    expect(recorded.some(({ element }) => element === row)).toBe(false);
    stop?.();
    expect(fallback.children).toHaveLength(0);
  });

  it('rolls back every started animation if creating another animation fails', () => {
    const mock = vi.mocked(host.animate);
    const cancel = vi.fn();
    mock.mockReturnValueOnce({ cancel } as unknown as Animation);
    mock.mockImplementationOnce(() => {
      throw new Error('unsupported');
    });
    play();
    expect(cancel).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
    expect(copies.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not schedule a scene without anchors or Web Animations support', () => {
    plan.active = false;
    play();
    expect(recorded).toHaveLength(0);
    plan.active = true;
    delete (Element.prototype as Partial<Element>).animate;
    play();
    expect(recorded).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('row section contacts', () => {
  it('connects all section edges with no gaps and holds both ends at the beaks', () => {
    const original = plan.conversation!.rect;
    for (const frame of plan.cargo) {
      const matrices = Array.from(
        { length: RAVEN_ROW_SECTIONS },
        (_, section) =>
          ravenSectionTransform(frame, section, original)
            .slice(7, -1)
            .split(',')
            .map(Number),
      );
      const point = (m: number[], x: number) => ({
        x: m[0] * x + (m[2] * original.height) / 2 + m[4] + original.left,
        y: m[1] * x + (m[3] * original.height) / 2 + m[5] + original.top,
      });
      for (let index = 0; index < matrices.length - 1; index++) {
        const end = point(matrices[index], original.width / RAVEN_ROW_SECTIONS);
        const start = point(matrices[index + 1], 0);
        expect(end.x).toBeCloseTo(start.x);
        expect(end.y).toBeCloseTo(start.y);
      }
      const left = point(matrices[0], 0);
      const right = point(matrices[4], original.width / RAVEN_ROW_SECTIONS);
      const angle = (frame.rotation * Math.PI) / 180;
      expect(left.x).toBeCloseTo(frame.x - (frame.width / 2) * Math.cos(angle));
      expect(right.x).toBeCloseTo(
        frame.x + (frame.width / 2) * Math.cos(angle),
      );
    }
  });
});
