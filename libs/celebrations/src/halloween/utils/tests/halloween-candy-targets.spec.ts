import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCandyTargets } from '../halloween-candy-targets';
const anchors = { composer: 'input-shell', starterList: 'starters' };
const measure = (element: Element, box: DOMRect) =>
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(box);
let composer: HTMLElement, button: HTMLButtonElement;
beforeEach(() => {
  document.body.innerHTML =
    '<main role="region"><div class="input-shell"><textarea>draft</textarea></div><ul class="starters"><li><button>Try something</button></li></ul></main>';
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 900,
  });
  composer = document.querySelector('.input-shell')!;
  button = document.querySelector('button')!;
  measure(composer, new DOMRect(350, 400, 580, 100));
  measure(button, new DOMRect(500, 550, 160, 44));
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
describe('Candy measured edges', () => {
  it('uses below/above starters without requiring their ordering', () => {
    expect(
      getCandyTargets(anchors, false).surfaces.map((s) => s.element),
    ).toEqual([composer, button]);
    vi.mocked(button.getBoundingClientRect).mockReturnValue(
      new DOMRect(500, 300, 160, 44),
    );
    expect(getCandyTargets(anchors, false).surfaces).toHaveLength(2);
  });
  it('measures a focused draft without starter anchors or DOM mutation', () => {
    const draft = document.querySelector('textarea')!;
    draft.focus();
    draft.setSelectionRange(1, 3);
    const html = composer.outerHTML;
    const result = getCandyTargets({ composer: 'input-shell' }, true);
    expect(result.surfaces.map((s) => s.element)).toEqual([composer]);
    expect(document.activeElement).toBe(draft);
    expect(draft.selectionStart).toBe(1);
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
    button.style.cssText = style;
    expect(getCandyTargets(anchors, false).surfaces).toEqual([]);
  });
  it('rejects clipping and honors direction from the host', () => {
    composer.parentElement!.style.cssText = 'overflow:hidden;direction:rtl';
    measure(composer.parentElement!, new DOMRect(0, 0, 600, 600));
    expect(getCandyTargets(anchors, true).surfaces).toEqual([]);
  });
  it('bounds inspection and selected surfaces', () => {
    const list = document.querySelector('ul')!;
    for (let i = 0; i < 30; i++) {
      const b = button.cloneNode(true) as HTMLElement;
      list.append(b);
      measure(b, new DOMRect(400 + i, 300, 100, 44));
    }
    expect(getCandyTargets(anchors, true).surfaces).toHaveLength(2);
    expect(getCandyTargets(anchors, false).surfaces).toHaveLength(3);
  });
  it('has an empty, safe fallback without anchors', () => {
    expect(getCandyTargets({}, true).surfaces).toEqual([]);
  });
});
