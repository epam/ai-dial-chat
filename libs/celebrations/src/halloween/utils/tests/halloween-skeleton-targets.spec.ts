import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSkeletonTargets,
  SKELETON_COMPOSER_LIMIT,
} from '../halloween-skeleton-targets';

const anchors = { composer: 'input-shell' };
const measure = (element: Element, box: DOMRect) =>
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(box);
let composer: HTMLElement;

beforeEach(() => {
  document.body.innerHTML =
    '<main><div class="input-shell"><textarea>draft</textarea></div></main>';
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 900,
  });
  composer = document.querySelector('.input-shell')!;
  composer.style.borderRadius = '16px';
  measure(composer, new DOMRect(340, 720, 600, 120));
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('getSkeletonTargets', () => {
  it('measures a focused draft composer without changing it', () => {
    const draft = document.querySelector('textarea')!;
    draft.focus();
    draft.setSelectionRange(1, 3);
    const html = composer.outerHTML;
    const result = getSkeletonTargets(anchors);
    expect(result.composer?.element).toBe(composer);
    expect(result.composer?.borderRadius).toBe('16px');
    expect(result.rtl).toBe(false);
    expect(document.activeElement).toBe(draft);
    expect([draft.selectionStart, draft.selectionEnd]).toEqual([1, 3]);
    expect(composer.outerHTML).toBe(html);
    expect(composer.getBoundingClientRect).toHaveBeenCalledOnce();
  });

  it.each([
    'transform:translateX(2px)',
    'display:none',
    'filter:blur(2px)',
    'opacity:0.5',
    'visibility:hidden',
  ])('rejects unsafe geometry: %s', (style) => {
    composer.style.cssText = style;
    expect(getSkeletonTargets(anchors).composer).toBeUndefined();
  });

  it('rejects hidden or clipped composers and reads host direction', () => {
    composer.parentElement!.style.cssText = 'overflow:hidden;direction:rtl';
    measure(composer.parentElement!, new DOMRect(0, 0, 600, 600));
    const clipped = getSkeletonTargets(anchors);
    expect(clipped.composer).toBeUndefined();
    expect(clipped.rtl).toBe(false);
    composer.parentElement!.style.cssText = '';
    /* jsdom does not inherit `direction`; browsers resolve it on the composer. */
    composer.style.direction = 'rtl';
    expect(getSkeletonTargets(anchors).rtl).toBe(true);
    composer.setAttribute('aria-hidden', 'true');
    expect(getSkeletonTargets(anchors).composer).toBeUndefined();
  });

  it('bounds the number of composer candidates', () => {
    const main = document.querySelector('main')!;
    const extra = Array.from({ length: 6 }, () => {
      const element = document.createElement('div');
      element.className = 'input-shell';
      element.style.display = 'none';
      main.prepend(element);
      return measure(element, new DOMRect(340, 720, 600, 120));
    });
    expect(getSkeletonTargets(anchors).composer).toBeUndefined();
    expect(extra.filter((spy) => spy.mock.calls.length > 0)).toHaveLength(
      SKELETON_COMPOSER_LIMIT,
    );
  });

  describe('greeting word', () => {
    let heading: HTMLElement;
    beforeEach(() => {
      vi.stubGlobal('CSS', { highlights: new Map() });
      vi.stubGlobal('Highlight', class {});
      document.body.innerHTML =
        '<main role="region"><h1>Good evening, <b>Valery</b>!</h1><div class="input-shell"><textarea></textarea></div></main>';
      composer = document.querySelector('.input-shell')!;
      heading = document.querySelector('h1')!;
      measure(composer, new DOMRect(340, 720, 600, 120));
      measure(heading, new DOMRect(500, 600, 280, 44));
      Range.prototype.getBoundingClientRect = () =>
        new DOMRect(700, 604, 90, 36);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    });

    it('takes the last word of the greeting without changing it', () => {
      const html = heading.outerHTML;
      const { word } = getSkeletonTargets({
        ...anchors,
        welcomeRegion: '[role="region"]',
      });
      expect(word?.text).toBe('Valery');
      expect(word?.heading).toBe(heading);
      expect(word?.range.toString()).toBe('Valery');
      expect(heading.outerHTML).toBe(html);
    });

    it('falls back to the greeting itself when there is no name', () => {
      heading.textContent = 'Good evening';
      expect(
        getSkeletonTargets({ ...anchors, welcomeRegion: '[role="region"]' })
          .word?.text,
      ).toBe('evening');
    });

    it('skips the word without the Highlight API or a visible heading', () => {
      const withRegion = { ...anchors, welcomeRegion: '[role="region"]' };
      vi.stubGlobal('Highlight', undefined);
      expect(getSkeletonTargets(withRegion).word).toBeUndefined();
      vi.stubGlobal('Highlight', class {});
      heading.style.visibility = 'hidden';
      expect(getSkeletonTargets(withRegion).word).toBeUndefined();
    });
  });

  it('returns a floor-only target without anchors', () => {
    expect(getSkeletonTargets({})).toEqual({
      width: 1280,
      height: 900,
      rtl: false,
      composer: undefined,
      word: undefined,
    });
  });
});
