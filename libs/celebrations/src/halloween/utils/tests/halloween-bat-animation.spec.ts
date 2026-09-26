import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateBats } from '../halloween-bat-animation';
import {
  BAT_RESTORE,
  BAT_SCENE_MS,
  BatPart,
  buildBatPlan,
  type BatPlan,
} from '../halloween-bat-plan';

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
let composer: HTMLElement;
let perch: HTMLButtonElement;
let draft: HTMLTextAreaElement;
let actors: HTMLElement[];
let plan: BatPlan;
let stop: (() => void) | undefined;
let notificationPortal: HTMLElement | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'timeline', {
    configurable: true,
    value: { currentTime: 2345 },
  });
  fixture = document.createElement('section');
  fixture.setAttribute('role', 'region');
  fixture.innerHTML = `
    <ul><li id="conversation" style="opacity: 0.7"><a href="/conversations/a" id="conversation-link"><span>My conversation</span></a></li></ul>
    <button id="starter" type="button"><span>Help me write</span></button>
    <section id="composer"><textarea aria-label="Message"></textarea><button id="perch" type="button" aria-label="Attach"><svg><path /></svg></button></section>`;
  document.body.appendChild(fixture);
  composer = fixture.querySelector<HTMLElement>('#composer')!;
  perch = fixture.querySelector<HTMLButtonElement>('#perch')!;
  draft = fixture.querySelector('textarea')!;
  draft.value = 'My unsent draft';
  draft.focus();
  draft.setSelectionRange(3, 9, 'backward');
  /* JSDOM schedules selectionchange when the initial selection is assigned. */
  vi.runOnlyPendingTimers();
  host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  copies = document.createElement('div');
  host.appendChild(copies);
  document.body.appendChild(host);
  plan = buildBatPlan(
    {
      width: 1280,
      height: 900,
      composer: { element: composer, rect: new DOMRect(420, 420, 540, 100) },
      perch: { element: perch, rect: new DOMRect(440, 470, 32, 32) },
      surfaces: [
        {
          element: fixture.querySelector<HTMLElement>('#conversation')!,
          rect: new DOMRect(200, 480, 200, 40),
        },
        {
          element: fixture.querySelector<HTMLElement>('#starter')!,
          rect: new DOMRect(500, 335, 180, 48),
        },
      ],
    },
    false,
    () => 0.5,
  );
  [
    ...plan.surfaces.map(({ target }) => target),
    plan.composer,
    plan.perch,
  ].forEach((target) => {
    if (target)
      vi.spyOn(target.element, 'getBoundingClientRect').mockReturnValue(
        target.rect,
      );
  });
  actors = plan.actors.map((bat) => {
    const actor = document.createElement('div');
    Object.keys(bat.parts).forEach((part) => {
      const artwork = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g',
      );
      artwork.setAttribute('data-bat-part', part);
      actor.appendChild(artwork);
    });
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
  notificationPortal?.remove();
  notificationPortal = undefined;
  document.documentElement.removeAttribute('dir');
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
  stop = animateBats(plan, { host, copies, actors }, onStop);
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
  vi.advanceTimersByTime(BAT_SCENE_MS);
  expect(onStop).toHaveBeenCalledOnce();
  recorded.forEach(({ animation }) =>
    expect(animation.cancel).toHaveBeenCalledOnce(),
  );
};

describe('bat crosswind animation ownership', () => {
  it('borrows only inert surfaces and preserves the live composer, focus, draft and selection', () => {
    const before = fixture.outerHTML;
    play();
    expect(plan.active).toBe(true);
    expect(plan.surfaces.length).toBeGreaterThan(0);
    expect(copies.children).toHaveLength(plan.surfaces.length);
    plan.surfaces.forEach(({ target, origin }, index) => {
      const copy = copies.children[index] as HTMLElement;
      expect(copy.inert).toBe(true);
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.style.pointerEvents).toBe('none');
      expect(copy.style.left).toBe(`${target.rect.left}px`);
      expect(copy.style.top).toBe(`${target.rect.top}px`);
      expect(copy.style.transformOrigin).toBe(origin);
      expect(copy.dataset.batSurface).toBe(String(index));
      expect(fixture.contains(target.element)).toBe(true);
    });
    expect(
      copies.querySelector('a[href], textarea, [aria-label="Attach"]'),
    ).toBeNull();
    expect(recorded.some(({ element }) => element === composer)).toBe(false);
    expect(recorded.some(({ element }) => element === perch)).toBe(false);
    expect(fixture.outerHTML).toBe(before);
    expect(document.activeElement).toBe(draft);
    expect(draft.value).toBe('My unsent draft');
    expect([
      draft.selectionStart,
      draft.selectionEnd,
      draft.selectionDirection,
    ]).toEqual([3, 9, 'backward']);
    stop?.();
    expectStopped();
    expect(fixture.outerHTML).toBe(before);
    expect(document.activeElement).toBe(draft);
    expect(draft.value).toBe('My unsent draft');
    expect([
      draft.selectionStart,
      draft.selectionEnd,
      draft.selectionDirection,
    ]).toEqual([3, 9, 'backward']);
  });

  it('aligns actors, all nine body parts, copies and original opacity without airflow elements', () => {
    play();
    expect(recorded.length).toBeGreaterThan(plan.actors.length);
    recorded.forEach(({ animation, options }) => {
      expect(animation.startTime).toBe(2345);
      expect(options).toEqual({ duration: BAT_SCENE_MS, fill: 'both' });
    });
    plan.actors.forEach((bat, index) => {
      expect(Object.keys(bat.parts)).toHaveLength(9);
      Object.entries(bat.parts).forEach(([part, frames]) => {
        const artwork = actors[index].querySelector(
          `[data-bat-part="${part}"]`,
        );
        const animation = recorded.find(({ element }) => element === artwork);
        expect(animation?.frames).toEqual(
          frames.map((frame) => ({ easing: 'ease-in-out', ...frame })),
        );
      });
    });
    expect(host.querySelector('[data-bat-gust]')).toBeNull();
    plan.surfaces.forEach(({ target, entry }) => {
      const animation = recorded.find(
        ({ element }) => element === target.element,
      )!;
      expect(animation.frames).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ offset: entry, opacity: 0 }),
          expect.objectContaining({ offset: BAT_RESTORE, opacity: 0 }),
        ]),
      );
      animation.frames.forEach((frame) =>
        expect(frame.transform).toBeUndefined(),
      );
    });
    expect(
      recorded
        .find(({ element }) => element.id === 'conversation')
        ?.frames.at(-1)?.opacity,
    ).toBe('0.7');
  });

  it('preserves per-keyframe easing overrides for precisely timed contacts', () => {
    plan.actors[0].frames[0].easing = 'linear';
    plan.actors[0].parts[BatPart.ForearmLeft][0].easing = 'steps(1, end)';
    play();
    expect(
      recorded.find(({ element }) => element === actors[0])?.frames[0].easing,
    ).toBe('linear');
    const forearm = actors[0].querySelector(
      `[data-bat-part="${BatPart.ForearmLeft}"]`,
    );
    expect(
      recorded.find(({ element }) => element === forearm)?.frames[0].easing,
    ).toBe('steps(1, end)');
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
    await vi.advanceTimersByTimeAsync(BAT_SCENE_MS - 1);
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
  ])('restores everything exactly once after %s', (reason) => {
    const before = fixture.outerHTML;
    play();
    if (reason === 'deadline') vi.advanceTimersByTime(BAT_SCENE_MS);
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
    expect(draft.value).toBe('My unsent draft');
    expect([draft.selectionStart, draft.selectionEnd]).toEqual([3, 9]);
  });

  it.each([
    'surface text',
    'surface removal',
    'surface disabled',
    'hidden ancestor',
    'composer removal',
    'composer class',
    'perch removal',
    'perch expanded',
    'html direction',
  ])(
    'restores originals when %s invalidates measured anchors',
    async (reason) => {
      play();
      const target = plan.surfaces[0].target.element;
      if (reason === 'surface text')
        target.textContent = 'Renamed conversation';
      else if (reason === 'surface removal') target.remove();
      else if (reason === 'surface disabled')
        target.setAttribute('aria-disabled', 'true');
      else if (reason === 'hidden ancestor') fixture.hidden = true;
      else if (reason === 'composer removal') composer.remove();
      else if (reason === 'composer class') composer.classList.add('expanded');
      else if (reason === 'perch removal') perch.remove();
      else if (reason === 'perch expanded')
        perch.setAttribute('aria-expanded', 'true');
      else document.documentElement.dir = 'rtl';
      await Promise.resolve();
      expectStopped();
      if (reason === 'surface text')
        expect(target.textContent).toBe('Renamed conversation');
      if (reason === 'hidden ancestor') expect(fixture.hidden).toBe(true);
      if (reason === 'composer removal')
        expect(composer.isConnected).toBe(false);
      if (reason === 'html direction')
        expect(document.documentElement.dir).toBe('rtl');
    },
  );

  it.each(['insertion', 'removal'])(
    'cancels when starter sibling %s shifts anchors inside the welcome region',
    async (change) => {
      const starter = document.createElement('button');
      starter.textContent = 'Another suggested prompt';
      if (change === 'removal') composer.before(starter);
      play();
      const { rect } = plan.composer!;
      vi.mocked(composer.getBoundingClientRect).mockReturnValue(
        new DOMRect(rect.x, rect.y + 48, rect.width, rect.height),
      );
      if (change === 'insertion') composer.before(starter);
      else starter.remove();
      await Promise.resolve();
      expectStopped();
      expect(document.activeElement).toBe(draft);
      expect(draft.value).toBe('My unsent draft');
      expect(starter.isConnected).toBe(change === 'insertion');
    },
  );

  it.each(['already visible', 'appears during playback'])(
    'finishes the whole scene when a notification portal %s dismisses after five seconds',
    async (appearance) => {
      notificationPortal = document.createElement('div');
      notificationPortal.style.position = 'fixed';
      notificationPortal.textContent = 'Halloween surprise';
      if (appearance === 'already visible')
        document.body.appendChild(notificationPortal);
      play();
      const activeCopies = [...copies.children];
      if (appearance === 'appears during playback') {
        document.body.appendChild(notificationPortal);
        await Promise.resolve();
        expect(onStop).not.toHaveBeenCalled();
      }
      await vi.advanceTimersByTimeAsync(5000);
      notificationPortal.remove();
      await Promise.resolve();
      expect(onStop).not.toHaveBeenCalled();
      expect([...copies.children]).toEqual(activeCopies);
      recorded.forEach(({ animation }) =>
        expect(animation.cancel).not.toHaveBeenCalled(),
      );
      await vi.advanceTimersByTimeAsync(BAT_SCENE_MS - 5001);
      expect(onStop).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expectStopped();
    },
  );

  it('continues when a sibling changes without moving the measured anchors', async () => {
    play();
    const sibling = document.createElement('span');
    composer.before(sibling);
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    sibling.remove();
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    expect(copies.children).toHaveLength(plan.surfaces.length);
  });

  it('ignores own scroll restoration and mutations in unrelated branches', async () => {
    const unrelated = document.createElement('div');
    fixture.appendChild(unrelated);
    play();
    copies.firstElementChild!.dispatchEvent(
      new Event('scroll', { bubbles: true }),
    );
    actors[0].setAttribute('class', 'decorative');
    unrelated.textContent = 'Other page content';
    await Promise.resolve();
    unrelated.textContent = 'Updated page content';
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    expect(copies.children).toHaveLength(plan.surfaces.length);
    [
      ...plan.surfaces.map(({ target }) => target),
      plan.composer,
      plan.perch,
    ].forEach((target) => {
      if (target)
        expect(target.element.getBoundingClientRect).not.toHaveBeenCalled();
    });
  });

  it('ignores child-list records that only change the decorative host', async () => {
    play();
    const decoration = document.createElement('div');
    host.appendChild(decoration);
    decoration.remove();
    host.remove();
    document.body.appendChild(host);
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    expect(copies.children).toHaveLength(plan.surfaces.length);
  });

  it.each(['actor', 'expression', 'snapshot copy', 'original opacity'])(
    'rolls back partial setup when the %s animation fails',
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
        if (
          (failure === 'actor' && this === actors[1]) ||
          (failure === 'expression' && this.hasAttribute('data-bat-part')) ||
          (failure === 'snapshot copy' &&
            this.hasAttribute('data-celebration-snapshot')) ||
          (failure === 'original opacity' &&
            this === plan.surfaces[0].target.element)
        )
          throw new Error('Animation unavailable');
        return animate.call(this, frames, options);
      });
      play();
      expect(recorded.length).toBeGreaterThan(0);
      expectStopped();
      expect(fixture.outerHTML).toBe(before);
    },
  );

  it.each(['actor', 'artwork'])(
    'cancels cleanly when a required %s is missing',
    (missing) => {
      if (missing === 'actor') actors.pop();
      else actors[1].firstElementChild!.remove();
      play();
      expectStopped();
    },
  );

  it('monitors composer anchors even when no safe surfaces can be borrowed', async () => {
    plan.surfaces = [];
    play();
    expect(recorded.length).toBeGreaterThan(0);
    expect(copies.children).toHaveLength(0);
    composer.hidden = true;
    await Promise.resolve();
    expectStopped();
  });

  it('does not borrow or schedule work for inactive plans or unsupported WAAPI', () => {
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
