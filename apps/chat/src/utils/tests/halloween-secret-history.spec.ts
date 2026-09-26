import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HalloweenBurst } from '../../types/halloween';
import { CELEBRATION_HISTORY_CLASS } from '../celebration-history';
import {
  animateSecretSceneHistory,
  getSecretSceneTargets,
} from '../halloween-secret-history';

let panel: HTMLElement;
let host: HTMLElement;
const stops: (() => void)[] = [];
const cancels: ReturnType<typeof vi.fn>[] = [];
const stage = new DOMRect(700, 200, 260, 260);
const scenes = [HalloweenBurst.Cauldron, HalloweenBurst.Mimic];
const play = (scene = HalloweenBurst.Cauldron) => {
  const stop = animateSecretSceneHistory(
    scene,
    getSecretSceneTargets(),
    host,
    stage,
  );
  stops.push(stop);
  return stop;
};

describe('secret scene history interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    panel = document.createElement('aside');
    panel.className = CELEBRATION_HISTORY_CLASS;
    panel.innerHTML =
      '<h2>Conversations</h2><ul><li><a id="first" href="/conversations/first">First chat</a></li><li><a id="second" href="/conversations/second">Second chat</a></li></ul>';
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 300, 800),
    );
    panel
      .querySelectorAll('li')
      .forEach((row, index) =>
        vi
          .spyOn(row, 'getBoundingClientRect')
          .mockReturnValue(new DOMRect(10, 100 + index * 40, 280, 36)),
      );
    host = document.createElement('div');
    document.body.append(panel, host);
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
    panel.remove();
    host.remove();
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('borrows visible rows for the cauldron scene', () => {
    expect(
      getSecretSceneTargets().map(({ element }) => element.tagName),
    ).toEqual(['LI', 'LI']);
  });

  it.each(['focus', 'expanded', 'hidden', 'closed', 'clipped', 'empty'])(
    'leaves an unsafe %s panel alone',
    (reason) => {
      if (reason === 'focus') panel.querySelector('a')?.focus();
      if (reason === 'expanded') {
        panel.querySelector('a')?.setAttribute('aria-haspopup', 'menu');
        panel.querySelector('a')?.setAttribute('aria-expanded', 'true');
      }
      if (reason === 'hidden') panel.style.display = 'none';
      if (reason === 'closed') panel.setAttribute('inert', '');
      if (reason === 'clipped') {
        panel.style.overflow = 'hidden';
        vi.mocked(panel.getBoundingClientRect).mockReturnValue(
          new DOMRect(-100, 0, 300, 800),
        );
      }
      if (reason === 'empty') panel.replaceChildren();
      expect(getSecretSceneTargets()).toHaveLength(
        reason === 'focus' || reason === 'expanded' ? 1 : 0,
      );
    },
  );

  it.each(scenes)(
    'keeps %s snapshots inert and restores without changing real markup',
    (scene) => {
      const original = panel.outerHTML;
      const stop = play(scene);
      expect(host.children.length).toBe(2);
      expect(host.querySelector('[href], .celebration-history')).toBeNull();
      const ids = Array.from(
        document.querySelectorAll('[id]'),
        (node) => node.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      Array.from(host.children).forEach((copy) => {
        expect((copy as HTMLElement).inert).toBe(true);
        expect(copy.getAttribute('aria-hidden')).toBe('true');
      });
      expect(panel.outerHTML).toBe(original);
      vi.advanceTimersByTime(8000);
      stop();
      expect(host.children).toHaveLength(0);
      cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
      expect(panel.outerHTML).toBe(original);
    },
  );

  it('does not mistake expanded history groups for an open action menu', () => {
    const group = document.createElement('button');
    group.setAttribute('aria-expanded', 'true');
    panel.prepend(group);
    expect(getSecretSceneTargets()).toHaveLength(2);
  });

  it.each([
    'scroll',
    'pointerdown',
    'focusin',
    'keydown',
    'visibilitychange',
    'resize',
  ])('restores the panel immediately on %s', (name) => {
    play();
    (name === 'resize' ? window : document).dispatchEvent(new Event(name));
    expect(host.children).toHaveLength(0);
    cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
  });

  it.each(['remove', 'rename', 'recycle', 'style', 'close', 'direction'])(
    'cancels if the original changes: %s',
    async (change) => {
      play();
      if (change === 'remove') panel.remove();
      if (change === 'rename')
        panel.querySelector('a')?.replaceChildren('Updated');
      if (change === 'recycle')
        panel.querySelector('a')?.setAttribute('href', '/conversations/other');
      if (change === 'style') panel.style.width = '100px';
      if (change === 'close') panel.setAttribute('inert', '');
      if (change === 'direction') panel.setAttribute('dir', 'rtl');
      await Promise.resolve();
      expect(host.children).toHaveLength(0);
    },
  );

  it('does not cancel for unrelated notification changes', async () => {
    play();
    const notification = document.createElement('p');
    document.body.appendChild(notification);
    notification.textContent = 'The cauldron has borrowed two chats';
    await Promise.resolve();
    expect(host.children).toHaveLength(2);
    notification.remove();
  });

  it('restores immediately if animation fails after the copy starts', () => {
    vi.mocked(host.animate)
      .mockImplementationOnce(
        () => ({ cancel: vi.fn() }) as unknown as Animation,
      )
      .mockImplementationOnce(() => {
        throw new Error('Unavailable');
      });
    const original = panel.outerHTML;
    play();
    expect(host.children).toHaveLength(0);
    expect(panel.outerHTML).toBe(original);
  });

  it('skips large snapshots and browsers without animation support', () => {
    for (let i = 0; i < 1500; i++)
      panel
        .querySelectorAll('li')
        .forEach((row) => row.appendChild(document.createElement('span')));
    play();
    expect(host.children).toHaveLength(0);
    expect(host.animate).not.toHaveBeenCalled();
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    play();
    expect(host.children).toHaveLength(0);
  });
});
