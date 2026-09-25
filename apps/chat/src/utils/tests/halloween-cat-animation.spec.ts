import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateCat } from '../halloween-cat-animation';
import {
  CAT_RESTORE,
  CAT_SCENE_MS,
  CatPart,
  buildCatPlan,
  type CatPlan,
} from '../halloween-cat-plan';

const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
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
let actor: HTMLElement;
let facing: HTMLElement;
let composer: HTMLElement;
let draft: HTMLTextAreaElement;
let plan: CatPlan;
let stop: (() => void) | undefined;
let notification: HTMLElement | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'timeline', {
    configurable: true,
    value: { currentTime: 2345 },
  });
  fixture = document.createElement('section');
  fixture.innerHTML = `<section id="composer"><textarea aria-label="Message"></textarea>
    <button id="first" type="button" style="opacity: 0.7"><span>Attach</span></button>
    <button id="second" type="button"><svg><path /></svg></button></section>
    <button id="support" type="button">Help me write</button>`;
  document.body.appendChild(fixture);
  composer = fixture.querySelector<HTMLElement>('#composer')!;
  draft = fixture.querySelector('textarea')!;
  draft.value = 'My unsent draft';
  draft.focus();
  draft.setSelectionRange(3, 9, 'backward');
  vi.runOnlyPendingTimers();
  host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  copies = document.createElement('div');
  actor = document.createElement('div');
  facing = document.createElement('div');
  actor.appendChild(facing);
  host.append(copies, actor);
  document.body.appendChild(host);
  plan = buildCatPlan({
    width: 1280,
    height: 900,
    composer: { element: composer, rect: new DOMRect(420, 420, 540, 100) },
    buttons: [
      { element: fixture.querySelector<HTMLElement>('#first')!, rect: new DOMRect(440, 470, 40, 40) },
      { element: fixture.querySelector<HTMLElement>('#second')!, rect: new DOMRect(492, 470, 40, 40) },
    ],
    supports: [{ element: fixture.querySelector<HTMLElement>('#support')!, rect: new DOMRect(420, 570, 300, 44) }],
  }, false);
  plan.anchors.forEach(({ element, rect }) => {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
  });
  Object.keys(plan.parts).forEach((part) => {
    const artwork = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    artwork.setAttribute('data-cat-part', part);
    facing.appendChild(artwork);
  });
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
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
  notification?.remove();
  notification = undefined;
  document.documentElement.removeAttribute('dir');
  recorded.length = 0;
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(Element.prototype, 'animate');
  if (originalTimeline) Object.defineProperty(document, 'timeline', originalTimeline);
  else Reflect.deleteProperty(document, 'timeline');
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const play = () => {
  stop = animateCat(plan, { host, copies, actor, facing }, onStop);
};

const expectStopped = () => {
  expect(copies.children).toHaveLength(0);
  expect(onStop).toHaveBeenCalledOnce();
  recorded.forEach(({ animation }) => expect(animation.cancel).toHaveBeenCalledOnce());
  expect(vi.getTimerCount()).toBe(0);
  stop?.();
  document.dispatchEvent(new Event('pointerdown'));
  window.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(CAT_SCENE_MS);
  expect(onStop).toHaveBeenCalledOnce();
  recorded.forEach(({ animation }) => expect(animation.cancel).toHaveBeenCalledOnce());
};

describe('cat gravity animation ownership', () => {
  it('borrows only inert buttons and leaves the focused composer, draft and backward selection intact', () => {
    const before = fixture.outerHTML;
    play();
    expect(plan.active).toBe(true);
    expect(plan.buttons).toHaveLength(2);
    expect(copies.children).toHaveLength(2);
    plan.buttons.forEach(({ target }, index) => {
      const copy = copies.children[index] as HTMLElement;
      expect(copy.inert).toBe(true);
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.style.pointerEvents).toBe('none');
      expect(copy.style.left).toBe(`${target.rect.left}px`);
      expect(copy.style.top).toBe(`${target.rect.top}px`);
      expect(copy.dataset.catPrize).toBe(String(index));
      expect(fixture.contains(target.element)).toBe(true);
    });
    expect(copies.querySelector('textarea, #composer')).toBeNull();
    expect(recorded.some(({ element }) => element === composer)).toBe(false);
    expect(fixture.outerHTML).toBe(before);
    expect(document.activeElement).toBe(draft);
    expect(draft.value).toBe('My unsent draft');
    expect([draft.selectionStart, draft.selectionEnd, draft.selectionDirection]).toEqual([3, 9, 'backward']);
    stop?.();
    expectStopped();
    expect(fixture.outerHTML).toBe(before);
    expect(document.activeElement).toBe(draft);
    expect(draft.value).toBe('My unsent draft');
    expect([draft.selectionStart, draft.selectionEnd, draft.selectionDirection]).toEqual([3, 9, 'backward']);
  });

  it('synchronizes cat and copies while limiting original animations to temporary opacity', () => {
    play();
    expect(recorded.some(({ element }) => element === actor)).toBe(true);
    expect(recorded.some(({ element }) => element === facing)).toBe(true);
    recorded.forEach(({ animation, options }) => {
      expect(animation.startTime).toBe(2345);
      expect(options).toEqual({ duration: CAT_SCENE_MS, fill: 'both' });
    });
    for (const { target, entry } of plan.buttons) {
      const original = recorded.find(({ element }) => element === target.element)!;
      expect(original.frames).toEqual(expect.arrayContaining([
        expect.objectContaining({ offset: entry, opacity: 0 }),
        expect.objectContaining({ offset: CAT_RESTORE, opacity: 0 }),
      ]));
      original.frames.forEach((frame) => expect(frame.transform).toBeUndefined());
    }
    expect(recorded.find(({ element }) => element.id === 'first')?.frames.at(-1)?.opacity).toBe('0.7');
  });

  it('preserves contact-specific keyframe easing', () => {
    plan.frames[0].easing = 'linear';
    plan.parts[CatPart.Forearm][0].easing = 'steps(1, end)';
    play();
    expect(recorded.find(({ element }) => element === actor)?.frames[0].easing).toBe('linear');
    expect(recorded.find(({ element }) => element.getAttribute('data-cat-part') === CatPart.Forearm)?.frames[0].easing).toBe('steps(1, end)');
  });

  it('does not poll layout, styles or animation frames while the scene plays', async () => {
    const computed = vi.spyOn(window, 'getComputedStyle');
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    play();
    const styleReads = computed.mock.calls.length;
    const animationCount = recorded.length;
    expect(styleReads).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(CAT_SCENE_MS - 1);
    expect(computed).toHaveBeenCalledTimes(styleReads);
    plan.anchors.forEach(({ element }) => expect(element.getBoundingClientRect).not.toHaveBeenCalled());
    expect(raf).not.toHaveBeenCalled();
    expect(recorded).toHaveLength(animationCount);
    expect(copies.children).toHaveLength(2);
    expect(onStop).not.toHaveBeenCalled();
  });

  it.each(['pointerdown', 'focusin', 'keydown', 'beforeinput', 'input', 'compositionstart', 'scroll', 'resize', 'deadline', 'unmount', 'hidden document'])(
    'restores everything exactly once after %s', (reason) => {
      const before = fixture.outerHTML;
      play();
      if (reason === 'deadline') vi.advanceTimersByTime(CAT_SCENE_MS);
      else if (reason === 'unmount') stop?.();
      else if (reason === 'hidden document') {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      } else (reason === 'resize' ? window : document).dispatchEvent(new Event(reason));
      expectStopped();
      expect(fixture.outerHTML).toBe(before);
      expect(draft.value).toBe('My unsent draft');
      expect([draft.selectionStart, draft.selectionEnd, draft.selectionDirection]).toEqual([3, 9, 'backward']);
    },
  );

  it.each(['button text', 'button removal', 'button disabled', 'button expanded', 'hidden ancestor', 'composer removal', 'composer class', 'html direction'])(
    'restores originals when %s invalidates a live anchor', async (reason) => {
      play();
      const target = plan.buttons[0].target.element;
      if (reason === 'button text') target.textContent = 'Changed label';
      else if (reason === 'button removal') target.remove();
      else if (reason === 'button disabled') target.setAttribute('disabled', '');
      else if (reason === 'button expanded') target.setAttribute('aria-expanded', 'true');
      else if (reason === 'hidden ancestor') fixture.hidden = true;
      else if (reason === 'composer removal') composer.remove();
      else if (reason === 'composer class') composer.classList.add('expanded');
      else document.documentElement.dir = 'rtl';
      await Promise.resolve();
      expectStopped();
      if (reason === 'button text') expect(target.textContent).toBe('Changed label');
      if (reason === 'hidden ancestor') expect(fixture.hidden).toBe(true);
    },
  );

  it.each(['already visible', 'appears during playback'])(
    'survives a fixed notification that is %s and disappears after five seconds', async (appearance) => {
      notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.textContent = 'Halloween secret phrase';
      if (appearance === 'already visible') document.body.appendChild(notification);
      play();
      const activeCopies = [...copies.children];
      if (appearance === 'appears during playback') {
        document.body.appendChild(notification);
        await Promise.resolve();
        expect(onStop).not.toHaveBeenCalled();
      }
      await vi.advanceTimersByTimeAsync(5000);
      notification.remove();
      await Promise.resolve();
      expect(onStop).not.toHaveBeenCalled();
      expect([...copies.children]).toEqual(activeCopies);
      recorded.forEach(({ animation }) => expect(animation.cancel).not.toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(CAT_SCENE_MS - 5001);
      expect(onStop).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expectStopped();
    },
  );

  it.each([false, true])('handles an ancestor sibling insertion with actual layout shift=%s', async (shifted) => {
    play();
    const anchor = plan.anchors.find(({ element }) => element === composer)!;
    if (shifted) vi.mocked(composer.getBoundingClientRect).mockReturnValue(new DOMRect(
      anchor.rect.left, anchor.rect.top + 48, anchor.rect.width, anchor.rect.height,
    ));
    composer.before(document.createElement('div'));
    await Promise.resolve();
    if (shifted) expectStopped();
    else {
      expect(onStop).not.toHaveBeenCalled();
      expect(copies.children).toHaveLength(2);
    }
  });

  it('ignores its own scroll, artwork mutations and unrelated descendants without measuring anchors', async () => {
    const unrelated = document.createElement('div');
    fixture.appendChild(unrelated);
    play();
    copies.firstElementChild!.dispatchEvent(new Event('scroll', { bubbles: true }));
    actor.classList.add('decorative');
    unrelated.textContent = 'Unrelated update';
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    plan.anchors.forEach(({ element }) => expect(element.getBoundingClientRect).not.toHaveBeenCalled());
  });

  it('ignores insertion and removal of its decorative host', async () => {
    play();
    host.remove();
    document.body.appendChild(host);
    await Promise.resolve();
    expect(onStop).not.toHaveBeenCalled();
    expect(copies.children).toHaveLength(2);
  });

  it.each(['actor', 'expression', 'snapshot', 'original opacity'])(
    'rolls back partial setup when %s animation fails', (failure) => {
      const before = fixture.outerHTML;
      const animate = vi.mocked(Element.prototype.animate).getMockImplementation()!;
      vi.spyOn(Element.prototype, 'animate').mockImplementation(function (this: Element, frames, options) {
        if ((failure === 'actor' && this === actor) ||
          (failure === 'expression' && this.hasAttribute('data-cat-part')) ||
          (failure === 'snapshot' && this.hasAttribute('data-celebration-snapshot')) ||
          (failure === 'original opacity' && this === plan.buttons[0].target.element))
          throw new Error('Animation unavailable');
        return animate.call(this, frames, options);
      });
      play();
      expectStopped();
      expect(fixture.outerHTML).toBe(before);
    },
  );

  it('cleans up if required artwork is missing', () => {
    facing.firstElementChild!.remove();
    play();
    expectStopped();
  });

  it('does not borrow or schedule work for inactive plans or unsupported WAAPI', () => {
    plan.active = false;
    play();
    expect(recorded).toHaveLength(0);
    expect(copies.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    plan.active = true;
    Reflect.deleteProperty(Element.prototype, 'animate');
    play();
    expect(recorded).toHaveLength(0);
    expect(copies.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(onStop).not.toHaveBeenCalled();
  });
});
