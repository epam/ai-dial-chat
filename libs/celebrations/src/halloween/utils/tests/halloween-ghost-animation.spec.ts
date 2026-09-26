import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateGhosts } from '../halloween-ghost-animation';
import {
  buildGhostPlan,
  GHOST_RESTORE,
  GHOST_SCENE_MS,
  type GhostPlan,
} from '../halloween-ghost-plan';

const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const originalTimeline = Object.getOwnPropertyDescriptor(document, 'timeline');
const onStop = vi.fn();
const recorded: {
  element: Element;
  frames: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: { cancel: ReturnType<typeof vi.fn>; startTime?: number };
}[] = [];
let fixture: HTMLElement;
let host: HTMLElement;
let copies: HTMLElement;
let pumpkin: HTMLButtonElement;
let faceTemplate: HTMLElement;
let pumpkinGlow: HTMLElement;
let draft: HTMLTextAreaElement;
let actors: HTMLElement[];
let plan: GhostPlan;
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'timeline', {
    configurable: true,
    value: { currentTime: 2345 },
  });
  fixture = document.createElement('section');
  fixture.innerHTML = `
    <ul><li id="conversation" style="opacity: 0.7"><a href="/conversations/a" id="conversation-link"><span>My conversation</span></a></li></ul>
    <button id="starter" type="button"><span>Help me write</span></button>
    <button id="attachment" type="button" aria-label="Attach"><svg><defs><linearGradient id="icon-glow" /></defs><path fill="url(#icon-glow)" /></svg></button>
    <textarea aria-label="Message"></textarea>
    <button id="pumpkin" type="button" aria-label="Halloween"><svg><g data-halloween-pumpkin-light><path /></g></svg></button>`;
  document.body.appendChild(fixture);
  pumpkin = fixture.querySelector<HTMLButtonElement>('#pumpkin')!;
  draft = fixture.querySelector('textarea')!;
  draft.value = 'My unsent draft';
  pumpkin.focus();
  host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  copies = document.createElement('div');
  faceTemplate = document.createElement('div');
  faceTemplate.id = 'possessed-face-template';
  faceTemplate.hidden = true;
  faceTemplate.innerHTML =
    '<svg><circle data-ghost-pupil /><circle data-ghost-pupil /></svg>';
  pumpkinGlow = document.createElement('div');
  host.append(copies, faceTemplate, pumpkinGlow);
  document.body.appendChild(host);
  plan = buildGhostPlan(
    {
      width: 1280,
      height: 800,
      pumpkin: { element: pumpkin, rect: new DOMRect(1050, 560, 120, 120) },
      homes: [
        {
          element: fixture.querySelector<HTMLElement>('#conversation')!,
          rect: new DOMRect(20, 150, 230, 40),
        },
        {
          element: fixture.querySelector<HTMLElement>('#starter')!,
          rect: new DOMRect(500, 380, 210, 48),
        },
        {
          element: fixture.querySelector<HTMLElement>('#attachment')!,
          rect: new DOMRect(410, 600, 32, 32),
        },
      ],
    },
    false,
    () => 0.5,
  );
  actors = plan.actors.map(() => {
    const actor = document.createElement('div');
    actor.innerHTML =
      '<div data-ghost-cloth><svg><g data-ghost-calm-face /><g data-ghost-fright-face /><g data-ghost-arms /></svg></div>';
    host.appendChild(actor);
    return actor;
  });
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(function (
      this: Element,
      frames: Keyframe[],
      options: KeyframeAnimationOptions,
    ) {
      const animation = { cancel: vi.fn() };
      recorded.push({ element: this, frames, options, animation });
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
  stop = animateGhosts(
    plan,
    { host, copies, actors, faceTemplate, pumpkinGlow },
    onStop,
  );
};

const expectStopped = () => {
  expect(copies.children).toHaveLength(0);
  expect(onStop).toHaveBeenCalledOnce();
  recorded.forEach(({ animation }) =>
    expect(animation.cancel).toHaveBeenCalledOnce(),
  );
  expect(vi.getTimerCount()).toBe(0);
  stop?.();
  document.dispatchEvent(new Event('pointerdown'));
  window.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(GHOST_SCENE_MS);
  expect(onStop).toHaveBeenCalledOnce();
  recorded.forEach(({ animation }) =>
    expect(animation.cancel).toHaveBeenCalledOnce(),
  );
};

describe('ghost animation ownership', () => {
  it('borrows inert copies with attached eyes without changing original DOM, focus or drafts', () => {
    const before = fixture.outerHTML;
    play();
    expect(copies.children).toHaveLength(plan.homes.length);
    plan.homes.forEach(({ target }, index) => {
      const copy = copies.children[index] as HTMLElement;
      expect(copy.inert).toBe(true);
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.style.pointerEvents).toBe('none');
      expect(copy.style.left).toBe(`${target.rect.left}px`);
      expect(copy.style.top).toBe(`${target.rect.top}px`);
      expect(
        copy.contains(copy.querySelector('[data-ghost-possessed-face]')),
      ).toBe(true);
      const face = copy.querySelector<HTMLElement>(
        '[data-ghost-possessed-face]',
      )!;
      expect(face.hidden).toBe(false);
      expect(face.id).toBe('');
      expect(face.parentElement).toBe(copy);
      expect(face.querySelectorAll('[data-ghost-pupil]')).toHaveLength(2);
      expect(fixture.contains(target.element)).toBe(true);
    });
    expect(copies.querySelector('a[href]')).toBeNull();
    expect(copies.querySelector('textarea')).toBeNull();
    const ids = Array.from(
      document.querySelectorAll('[id]'),
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    const fill = copies.querySelector('path')!.getAttribute('fill')!;
    expect(copies.querySelector(`[id="${fill.slice(5, -1)}"]`)).not.toBeNull();
    expect(fixture.outerHTML).toBe(before);
    expect(document.activeElement).toBe(pumpkin);
    expect(draft.value).toBe('My unsent draft');
    stop?.();
    expect(fixture.outerHTML).toBe(before);
    expect(document.activeElement).toBe(pumpkin);
    expect(draft.value).toBe('My unsent draft');
  });

  it('aligns ghost, eyes, copies, original opacity and pumpkin artwork on one timeline', () => {
    play();
    expect(recorded.length).toBeGreaterThan(plan.actors.length);
    recorded.forEach(({ animation, options }) => {
      expect(animation.startTime).toBe(2345);
      expect(options).toEqual({ duration: GHOST_SCENE_MS, fill: 'both' });
    });
    expect(
      recorded.some(({ element }) => element === pumpkin.querySelector('svg')),
    ).toBe(true);
    expect(recorded.some(({ element }) => element === pumpkin)).toBe(false);
    plan.homes.forEach(({ target, entry }) => {
      const animation = recorded.find(
        ({ element }) => element === target.element,
      )!;
      expect(animation.frames).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ offset: entry, opacity: 0 }),
          expect.objectContaining({ offset: GHOST_RESTORE, opacity: 0 }),
        ]),
      );
      animation.frames.forEach((frame) =>
        expect(frame.transform).toBeUndefined(),
      );
    });
    const originalOpacity = recorded.find(
      ({ element }) => element === plan.homes[0].target.element,
    )!;
    expect(originalOpacity.frames.at(-1)?.opacity).toBe('0.7');
  });

  it('brightens the original pumpkin grin without replacing or moving its light group', () => {
    const light = pumpkin.querySelector('[data-halloween-pumpkin-light]')!;
    const artwork = light.parentElement;
    const before = pumpkin.outerHTML;
    play();
    const lightAnimations = recorded.filter(({ element }) => element === light);
    expect(lightAnimations).toHaveLength(1);
    const { frames, animation } = lightAnimations[0];
    expect(animation.startTime).toBe(2345);
    expect(frames[0].filter).toBe('brightness(1)');
    expect(frames.at(-1)?.filter).toBe('brightness(1)');
    expect(frames.some((frame) => frame.filter === 'brightness(1.8)')).toBe(
      true,
    );
    frames.forEach((frame) => {
      expect(frame.transform).toBeUndefined();
      expect(frame.opacity).toBeUndefined();
    });
    expect(
      document.querySelectorAll('[data-halloween-pumpkin-light]'),
    ).toHaveLength(1);
    expect(light.parentElement).toBe(artwork);
    expect(pumpkin.contains(light)).toBe(true);
    expect(pumpkin.outerHTML).toBe(before);
    expect(document.activeElement).toBe(pumpkin);
    stop?.();
    expectStopped();
    expect(animation.cancel).toHaveBeenCalledOnce();
    expect(pumpkin.querySelector('[data-halloween-pumpkin-light]')).toBe(light);
    expect(pumpkin.outerHTML).toBe(before);
  });

  it('does no recurring measurements, style reads, setup or animation frames during playback', async () => {
    const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    const computed = vi.spyOn(window, 'getComputedStyle');
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    play();
    const styleReads = computed.mock.calls.length;
    const animationCount = recorded.length;
    const snapshotCount = copies.children.length;
    expect(styleReads).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(GHOST_SCENE_MS - 1);
    expect(computed).toHaveBeenCalledTimes(styleReads);
    expect(bounds).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    expect(recorded).toHaveLength(animationCount);
    expect(copies.children).toHaveLength(snapshotCount);
    expect(onStop).not.toHaveBeenCalled();
  });

  it.each([
    'pointerdown',
    'focusin',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'resize',
    'deadline',
    'unmount',
    'hidden document',
  ])('restores everything once after %s', (reason) => {
    const before = fixture.outerHTML;
    play();
    if (reason === 'deadline') vi.advanceTimersByTime(GHOST_SCENE_MS);
    else if (reason === 'unmount') stop?.();
    else if (reason === 'hidden document') {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
    } else {
      (reason === 'resize' ? window : document).dispatchEvent(
        new Event(reason),
      );
    }
    expectStopped();
    expect(fixture.outerHTML).toBe(before);
  });

  it.each([
    'target text',
    'target removal',
    'hidden ancestor',
    'pumpkin removal',
    'pumpkin artwork',
  ])('cleans up when %s invalidates the scene', async (reason) => {
    play();
    const target = plan.homes[0].target.element;
    if (reason === 'target text') target.textContent = 'Renamed conversation';
    else if (reason === 'target removal') target.remove();
    else if (reason === 'hidden ancestor') fixture.hidden = true;
    else if (reason === 'pumpkin removal') pumpkin.remove();
    else
      pumpkin.querySelector('path')!.setAttribute('class', 'updated-artwork');
    await Promise.resolve();
    expectStopped();
    if (reason === 'target text')
      expect(target.textContent).toBe('Renamed conversation');
    if (reason === 'hidden ancestor') expect(fixture.hidden).toBe(true);
    if (reason === 'pumpkin removal') expect(pumpkin.isConnected).toBe(false);
  });

  it('ignores snapshot scroll restoration and mutations outside live anchors', async () => {
    play();
    copies.firstElementChild!.dispatchEvent(
      new Event('scroll', { bubbles: true }),
    );
    actors[0].setAttribute('class', 'decorative');
    const unrelated = document.createElement('div');
    fixture.appendChild(unrelated);
    unrelated.textContent = 'Other page content';
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    expect(copies.children).toHaveLength(plan.homes.length);
  });

  it.each(['actor', 'possessed face', 'snapshot copy', 'original opacity'])(
    'rolls back earlier animations and copies when %s animation fails',
    (failure) => {
      const before = fixture.outerHTML;
      const animate = vi
        .mocked(Element.prototype.animate)
        .getMockImplementation()!;
      vi.spyOn(Element.prototype, 'animate').mockImplementation(function (
        this: Element,
        frames,
        options,
      ) {
        const shouldThrow =
          (failure === 'actor' && this === actors[1]) ||
          (failure === 'possessed face' &&
            this.hasAttribute('data-ghost-possessed-face')) ||
          (failure === 'snapshot copy' &&
            this.hasAttribute('data-celebration-snapshot')) ||
          (failure === 'original opacity' &&
            this === plan.homes[0].target.element);
        if (shouldThrow) throw new Error('Animation unavailable');
        return animate.call(this, frames, options);
      });
      play();
      expect(recorded.length).toBeGreaterThan(0);
      expectStopped();
      expect(fixture.outerHTML).toBe(before);
    },
  );

  it('does not borrow or schedule animations for inactive plans or unsupported WAAPI', () => {
    plan.active = false;
    play();
    expect(recorded).toHaveLength(0);
    expect(copies.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    plan.active = true;
    delete (Element.prototype as Partial<Element>).animate;
    play();
    expect(recorded).toHaveLength(0);
    expect(copies.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(onStop).not.toHaveBeenCalled();
  });
});
