import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  animateMummyPush,
  buildMummyPushLayout,
  getMummyComposerTarget,
  MUMMY_ANIMATION_MS,
} from '../halloween-mummy';

const { CONVERSATION_INPUT_CLASS } =
  await import('@epam/ai-dial-conversation-input');

let composer: HTMLElement;
let textarea: HTMLTextAreaElement;
let host: HTMLElement;
let actor: HTMLElement;
const stops: (() => void)[] = [];
const cancels: ReturnType<typeof vi.fn>[] = [];
const rect = new DOMRect(440, 320, 700, 150);
const play = () => {
  const target = getMummyComposerTarget(CONVERSATION_INPUT_CLASS.wrapper);
  expect(target).not.toBeNull();
  if (!target) throw new Error('Missing composer fixture');
  const stop = animateMummyPush(
    target,
    host,
    actor,
    buildMummyPushLayout(rect, 1280, 800),
  );
  stops.push(stop);
  return stop;
};

describe('mummy composer interaction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    composer = document.createElement('div');
    composer.className = CONVERSATION_INPUT_CLASS.wrapper;
    textarea = document.createElement('textarea');
    textarea.value = 'Keep my draft';
    composer.appendChild(textarea);
    vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(rect);
    host = document.createElement('div');
    actor = document.createElement('div');
    document.body.append(composer, host, actor);
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => {
        const cancel = vi.fn();
        cancels.push(cancel);
        return { cancel };
      }),
    });
  });
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    cancels.length = 0;
    composer.remove();
    host.remove();
    actor.remove();
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps the focused textarea, draft and selection in place while borrowing an inert copy', () => {
    textarea.focus();
    textarea.setSelectionRange(2, 5);
    const markup = composer.outerHTML;
    play();
    expect(
      getMummyComposerTarget(CONVERSATION_INPUT_CLASS.wrapper)?.element,
    ).toBe(composer);
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(5);
    expect(host.querySelector('textarea')?.value).toBe('Keep my draft');
    expect((host.firstElementChild as HTMLElement).inert).toBe(true);
    expect(host.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(composer.outerHTML).toBe(markup);
    vi.advanceTimersByTime(MUMMY_ANIMATION_MS);
    expect(host.children).toHaveLength(0);
    expect(textarea.value).toBe('Keep my draft');
    expect(document.activeElement).toBe(textarea);
    cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
  });

  it('holds the input still through both failed shoves, then moves actor and copy together at full size', () => {
    play();
    const [actorCall, copyCall, originalCall] = vi.mocked(host.animate).mock
      .calls;
    const actorFrames = actorCall[0] as Keyframe[];
    const copyFrames = copyCall[0] as Keyframe[];
    copyFrames
      .filter((frame) => (frame.offset ?? 0) <= 0.36)
      .forEach((frame) => expect(frame.transform).toBe('translateX(0px)'));
    for (const offset of [0.15, 0.36, 0.46, 0.82, 1]) {
      expect(
        copyFrames.find((frame) => frame.offset === offset)?.transform,
      ).toBe(actorFrames.find((frame) => frame.offset === offset)?.transform);
    }
    expect(copyFrames.find((frame) => frame.offset === 0.46)?.transform).toBe(
      'translateX(22px)',
    );
    copyFrames.forEach((frame) =>
      expect(frame.transform).not.toMatch(/scale|rotate/),
    );
    const originalFrames = originalCall[0] as Keyframe[];
    expect(originalFrames.find((frame) => frame.offset === 0.94)?.opacity).toBe(
      0,
    );
    expect(originalFrames.at(-1)?.opacity).toBe('');
  });

  it.each([
    'beforeinput',
    'input',
    'compositionstart',
    'keydown',
    'pointerdown',
    'focusin',
    'scroll',
    'resize',
  ])('restores immediately on %s and cancels the actor as well', (name) => {
    const stop = play();
    (name === 'resize' ? window : textarea).dispatchEvent(
      new Event(name, { bubbles: true }),
    );
    expect(host.children).toHaveLength(0);
    stop();
    cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
  });

  it.each(['hidden', 'inert', 'disabled', 'offscreen', 'open menu'])(
    'skips an unavailable composer: %s',
    (reason) => {
      if (reason === 'hidden') composer.style.display = 'none';
      if (reason === 'inert') composer.setAttribute('inert', '');
      if (reason === 'disabled') textarea.disabled = true;
      if (reason === 'offscreen')
        vi.mocked(composer.getBoundingClientRect).mockReturnValue(
          new DOMRect(-20, 320, 700, 150),
        );
      if (reason === 'open menu')
        composer.insertAdjacentHTML(
          'beforeend',
          '<button aria-haspopup="menu" aria-expanded="true"></button>',
        );
      expect(
        getMummyComposerTarget(CONVERSATION_INPUT_CLASS.wrapper),
      ).toBeNull();
    },
  );

  it('ignores its own inert snapshot when the source is removed', () => {
    play();
    composer.remove();
    expect(getMummyComposerTarget(CONVERSATION_INPUT_CLASS.wrapper)).toBeNull();
  });

  it('preserves a scrolled draft without treating its snapshot scroll event as user input', () => {
    textarea.scrollTop = 80;
    play();
    const copy = host.querySelector('textarea');
    expect(copy?.scrollTop).toBe(80);
    copy?.dispatchEvent(new Event('scroll'));
    expect(host.children).toHaveLength(1);
    textarea.dispatchEvent(new Event('scroll'));
    expect(host.children).toHaveLength(0);
  });

  it('restores when the composer changes or is removed', async () => {
    play();
    composer.remove();
    await Promise.resolve();
    expect(host.children).toHaveLength(0);
    cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
  });

  it('cleans up the actor if snapshot creation fails', () => {
    for (let i = 0; i < 1500; i++)
      composer.appendChild(document.createElement('span'));
    expect(getMummyComposerTarget(CONVERSATION_INPUT_CLASS.wrapper)).toBeNull();
    stops.push(
      animateMummyPush(
        { element: composer, rect },
        host,
        actor,
        buildMummyPushLayout(rect, 1280, 800),
      ),
    );
    expect(host.children).toHaveLength(0);
    expect(cancels).toHaveLength(1);
    expect(cancels[0]).toHaveBeenCalledOnce();
  });

  it.each([360, 900, 1280, 1920])(
    'enters and fully exits either side at width %s',
    (width) => {
      const inputWidth = Math.min(width - 32, 700);
      for (const random of [0, 0.99]) {
        vi.spyOn(Math, 'random').mockReturnValue(random);
        const bounds = new DOMRect(
          (width - inputWidth) / 2,
          320,
          inputWidth,
          140,
        );
        const layout = buildMummyPushLayout(bounds, width, 800);
        const entry = layout.x + layout.entrance;
        const exit = layout.x + layout.distance;
        expect(layout.y).toBeGreaterThanOrEqual(0);
        expect(layout.y + layout.width * 1.3).toBeLessThanOrEqual(800);
        if (layout.direction === 1) {
          expect(entry + layout.width).toBeLessThanOrEqual(0);
          expect(exit).toBeGreaterThan(width);
          expect(bounds.left + layout.distance).toBeGreaterThan(width);
        } else {
          expect(entry).toBeGreaterThanOrEqual(width);
          expect(exit + layout.width).toBeLessThan(0);
          expect(bounds.right + layout.distance).toBeLessThan(0);
        }
      }
    },
  );
});
