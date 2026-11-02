/* Native text layout needs geometry fixtures; browser coverage checks real glyph positions. */
/* eslint-disable testing-library/no-node-access */
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  animateReindeerText,
  getReindeerText,
  type ReindeerText,
} from '../reindeer-text';

let input: HTMLTextAreaElement;
let composer: HTMLDivElement;
const rect = new DOMRect(110, 210, 200, 24);
const glyphs = new DOMRect(114, 213, 48, 18);
const nativeStyle = window.getComputedStyle;
describe('reindeer text contact', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div style="background:rgb(240, 240, 240)"><textarea aria-label="Draft" style="font-size:16px;color:rgb(20, 20, 20)"></textarea></div>';
    input = screen.getByRole('textbox', {
      name: 'Draft',
    }) as HTMLTextAreaElement;
    composer = input.parentElement as HTMLDivElement;
    input.placeholder = 'Type a message';
    input.style.background = 'transparent';
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect);
    vi.spyOn(
      HTMLSpanElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue(glyphs);
    vi.spyOn(HTMLSpanElement.prototype, 'getClientRects').mockReturnValue([
      glyphs,
    ] as unknown as DOMRectList);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      nativeStyle(element),
    );
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });
  const measure = () =>
    getReindeerText({
      element: composer,
      rect: new DOMRect(100, 200, 240, 80),
    });

  it('uses the existing placeholder when the editor is empty and removes its measuring mirror', () => {
    const before = document.body.innerHTML;
    const word = measure();
    expect(word?.text).toBe('Type');
    expect(word?.rect).toEqual(glyphs);
    expect(document.body.innerHTML).toBe(before);
    expect(input.value).toBe('');
  });
  it('borrows one word without changing a focused draft, selection or direction', () => {
    input.value = 'Winter wishes stay here';
    input.style.direction = 'rtl';
    input.focus();
    input.setSelectionRange(2, 7, 'backward');
    const word = measure();
    expect(word?.text).toBe('Winter');
    expect(word?.style.direction).toBe('rtl');
    expect(input.value).toBe('Winter wishes stay here');
    expect(document.activeElement).toBe(input);
    expect([
      input.selectionStart,
      input.selectionEnd,
      input.selectionDirection,
    ]).toEqual([2, 7, 'backward']);
  });
  it.each([
    'scrolled',
    'empty',
    'hidden',
    'disabled',
    'gradient',
    'clipped',
    'transparent-ink',
  ])('skips %s text instead of moving the editor', (kind) => {
    if (kind === 'scrolled') input.scrollTop = 20;
    if (kind === 'empty') input.placeholder = '';
    if (kind === 'hidden') input.hidden = true;
    if (kind === 'disabled') input.disabled = true;
    if (kind === 'gradient')
      vi.mocked(window.getComputedStyle).mockImplementation((element) => {
        const style = nativeStyle(element);
        if (element === composer)
          Object.defineProperty(style, 'backgroundImage', {
            value: 'linear-gradient(red, blue)',
          });
        return style;
      });
    if (kind === 'transparent-ink') input.style.color = 'transparent';
    if (kind === 'clipped')
      vi.spyOn(
        HTMLSpanElement.prototype,
        'getBoundingClientRect',
      ).mockReturnValue(new DOMRect(90, 200, 48, 18));
    expect(measure()).toBeNull();
    expect(document.body.children.length).toBe(1);
  });
  it('caps the copied word even for an oversized draft', () => {
    input.value = 'a'.repeat(10000);
    expect(measure()?.text).toHaveLength(32);
  });
  it('disposes text and pixel cover without animating or styling the live editor', () => {
    const word = measure() as ReindeerText;
    const host = document.createElement('div');
    document.body.append(host);
    const animations: {
      cancel: ReturnType<typeof vi.fn>;
      startTime: number | null;
    }[] = [];
    const receivers: Element[] = [];
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: vi.fn(function (this: Element) {
        receivers.push(this);
        const animation = { cancel: vi.fn(), startTime: null };
        animations.push(animation);
        return animation;
      }),
    });
    const before = input.outerHTML;
    const stop = animateReindeerText(
      word,
      host,
      [{ transform: 'translate(0,0)' }],
      23000,
      1234,
      0.2,
      0.7,
    );
    expect(host.children.length).toBe(2);
    expect(receivers).not.toContain(input);
    expect(animations.every((a) => a.startTime === 1234)).toBe(true);
    stop();
    expect(host.children.length).toBe(0);
    expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(
      true,
    );
    expect(input.outerHTML).toBe(before);
  });
});
