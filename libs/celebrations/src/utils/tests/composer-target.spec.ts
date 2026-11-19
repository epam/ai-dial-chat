import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { measureComposer } from '../composer-target';

const LIMITS = { minWidth: 338, headroom: 164 };

describe('measureComposer', () => {
  let composer: HTMLDivElement;

  beforeEach(() => {
    composer = document.createElement('div');
    composer.className = 'composer';
    composer.innerHTML = '<textarea aria-label="Message">Draft</textarea>';
    document.body.append(composer);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      900,
    );
    vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(300, 700, 680, 72),
    );
    const original = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = original(element);
      return {
        ...style,
        display: style.display,
        visibility: style.visibility || 'visible',
        opacity: style.opacity,
        contentVisibility: style.contentVisibility,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        direction: style.direction || 'ltr',
      } as CSSStyleDeclaration;
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('returns the eligible composer and the viewport size', () => {
    const measured = measureComposer('composer', LIMITS);
    expect(measured).toMatchObject({
      width: 1280,
      height: 900,
      rtl: false,
      composer: { box: { left: 300, top: 700, width: 680, height: 72 } },
    });
    expect(measured.composer?.source.element).toBe(composer);
  });

  it('leaves the draft, focus and selection untouched', () => {
    const input = composer.querySelector('textarea');
    if (!input) throw new Error('Missing draft');
    input.focus();
    input.setSelectionRange(1, 3);
    const before = composer.outerHTML;
    measureComposer('composer', LIMITS);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3]);
    expect(composer.outerHTML).toBe(before);
  });

  it.each([
    ['narrower than the minimum width', new DOMRect(300, 700, 300, 72)],
    ['shorter than 36 px', new DOMRect(300, 700, 680, 30)],
    ['taller than 260 px', new DOMRect(300, 500, 680, 300)],
    ['closer than 12 px to the start edge', new DOMRect(8, 700, 680, 72)],
    ['closer than 12 px to the end edge', new DOMRect(600, 700, 676, 72)],
    ['without headroom above it', new DOMRect(300, 150, 680, 72)],
    ['closer than 20 px to the bottom', new DOMRect(300, 820, 680, 72)],
  ])('rejects a composer %s', (_name, rect) => {
    vi.mocked(composer.getBoundingClientRect).mockReturnValue(rect);
    expect(measureComposer('composer', LIMITS).composer).toBeNull();
  });

  it.each([
    ['hidden', (parent: HTMLElement) => (parent.hidden = true)],
    ['inert', (parent: HTMLElement) => parent.setAttribute('inert', '')],
    [
      'aria-hidden',
      (parent: HTMLElement) => parent.setAttribute('aria-hidden', 'true'),
    ],
  ])('rejects a composer inside a %s ancestor', (_name, hide) => {
    const parent = document.createElement('div');
    document.body.append(parent);
    parent.append(composer);
    hide(parent);
    expect(measureComposer('composer', LIMITS).composer).toBeNull();
  });

  it('rejects a composer clipped by a scrolling ancestor', () => {
    const parent = document.createElement('div');
    parent.style.overflowY = 'auto';
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1280, 740),
    );
    document.body.append(parent);
    parent.append(composer);
    expect(measureComposer('composer', LIMITS).composer).toBeNull();
  });

  it('rejects a composer nested deeper than 24 ancestors', () => {
    let last: HTMLElement = document.body;
    for (let i = 0; i < 25; i++) {
      const next = document.createElement('div');
      last.append(next);
      last = next;
    }
    last.append(composer);
    expect(measureComposer('composer', LIMITS).composer).toBeNull();
  });

  it('inspects at most four candidates', () => {
    composer.remove();
    const candidates = Array.from({ length: 5 }, () => {
      const candidate = document.createElement('div');
      candidate.className = 'composer';
      document.body.append(candidate);
      return candidate;
    });
    candidates
      .slice(0, 4)
      .forEach((candidate) =>
        vi
          .spyOn(candidate, 'getBoundingClientRect')
          .mockReturnValue(new DOMRect(300, 700, 100, 72)),
      );
    const fifth = vi
      .spyOn(candidates[4], 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(300, 700, 680, 72));
    expect(measureComposer('composer', LIMITS).composer).toBeNull();
    expect(fifth).not.toHaveBeenCalled();
  });

  it('takes the direction from the composer', () => {
    composer.style.direction = 'rtl';
    expect(measureComposer('composer', LIMITS).rtl).toBe(true);
  });

  it('returns no composer when the host supplies no class', () => {
    expect(measureComposer(undefined, LIMITS).composer).toBeNull();
  });
});
