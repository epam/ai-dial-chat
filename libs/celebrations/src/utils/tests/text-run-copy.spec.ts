/* The copy and its cover are inert decorations; there is no accessible role to query them by. */
/* eslint-disable testing-library/no-node-access */
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextRun } from '../../models/text-run-copy';
import { prepareTextRunCopy } from '../text-run-copy';

const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const recorded: {
  element: Element;
  keyframes: Keyframe[];
  animation: { cancel: ReturnType<typeof vi.fn>; startTime: number | null };
}[] = [];
let textarea: HTMLTextAreaElement;
let host: HTMLDivElement;

const run = (): TextRun => ({
  element: textarea,
  rect: new DOMRect(114, 213, 48, 18),
  text: 'Type',
  style: { fontSize: '16px', color: 'rgb(20, 20, 20)' },
  background: 'rgb(240, 240, 240)',
});

const options = {
  durationMs: 23000,
  showAt: 0.4,
  hideAt: 0.8,
  frames: [
    { transform: 'translate(0px, 0px)' },
    { transform: 'translate(0px, -30px)' },
  ],
};

const animationsOn = (element: Element) =>
  recorded.filter((entry) => entry.element === element);

describe('prepareTextRunCopy', () => {
  beforeEach(() => {
    recorded.length = 0;
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value(this: Element, keyframes: Keyframe[]) {
        const animation = { cancel: vi.fn(), startTime: null };
        recorded.push({ element: this, keyframes, animation });
        return animation;
      },
    });
    document.body.innerHTML =
      '<textarea aria-label="Draft" placeholder="Type a message"></textarea><div></div>';
    textarea = screen.getByRole('textbox', {
      name: 'Draft',
    }) as HTMLTextAreaElement;
    host = document.body.lastElementChild as HTMLDivElement;
  });

  afterEach(() => {
    document.body.replaceChildren();
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  });

  it('attaches an invisible, inert cover and copy without animating anything', () => {
    const session = prepareTextRunCopy(run(), options);
    session.attach(host);

    const [cover, copy] = Array.from(host.children) as HTMLElement[];
    expect(copy.textContent).toBe('Type');
    expect(cover.style.backgroundColor).toBe('rgb(240, 240, 240)');
    for (const element of [cover, copy]) {
      expect(element.inert).toBe(true);
      expect(element.getAttribute('aria-hidden')).toBe('true');
      expect(element.style.opacity).toBe('0');
    }
    expect(recorded).toHaveLength(0);
  });

  it('starts every animation once on the given start time', () => {
    const session = prepareTextRunCopy(run(), options);
    session.attach(host);
    session.start(950);
    session.start(1200);

    const [cover, copy] = Array.from(host.children);
    expect(animationsOn(copy)).toHaveLength(2);
    expect(animationsOn(cover)).toHaveLength(1);
    recorded.forEach(({ animation }) => expect(animation.startTime).toBe(950));
  });

  it('carries only the copy on a travel layer, while the cover stays over the original', () => {
    const session = prepareTextRunCopy(run(), {
      ...options,
      travelFrames: [
        { transform: 'translate(0px, 0px)' },
        { transform: 'translate(-80px, 0px)' },
      ],
    });
    session.attach(host);
    session.start(950);

    const [cover, travel] = Array.from(host.children) as HTMLElement[];
    expect(cover.textContent).toBe('');
    expect(travel.firstElementChild?.textContent).toBe('Type');
    expect(travel.inert).toBe(true);
    expect(animationsOn(travel)).toHaveLength(1);
  });

  it('leaves the textarea value, selection, focus and attributes untouched', () => {
    textarea.value = 'Typed draft';
    textarea.focus();
    textarea.setSelectionRange(2, 5);
    const attributes = Array.from(textarea.attributes).map(
      ({ name, value }) => [name, value],
    );
    const session = prepareTextRunCopy(run(), options);
    session.attach(host);
    session.start(950);
    session.stop();

    expect(textarea.value).toBe('Typed draft');
    expect(document.activeElement).toBe(textarea);
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([2, 5]);
    expect(
      Array.from(textarea.attributes).map(({ name, value }) => [name, value]),
    ).toEqual(attributes);
    expect(animationsOn(textarea)).toHaveLength(0);
  });

  it('removes the cover, the copy and the travel layer and cancels each animation once', () => {
    const session = prepareTextRunCopy(run(), {
      ...options,
      travelFrames: [{ transform: 'translate(0px, 0px)' }],
    });
    session.attach(host);
    session.start(950);
    session.stop();
    session.stop();

    expect(host.children).toHaveLength(0);
    recorded.forEach(({ animation }) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
  });

  it('refuses to start a copy that was never attached', () => {
    expect(() => prepareTextRunCopy(run(), options).start(950)).toThrow(
      'not attached',
    );
  });
});
