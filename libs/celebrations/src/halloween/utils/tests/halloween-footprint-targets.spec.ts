import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FOOTPRINT_SCAN_LIMIT,
  getFootprintTargets,
} from '../halloween-footprint-targets';

let root: HTMLElement;
let composer: HTMLElement;
let starters: HTMLElement;
const anchors = {
  composer: 'footprint-composer',
  starterList: 'footprint-starters',
};
const bounds = (element: Element, x = 420, y = 280, width = 140, height = 44) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(x, y, width, height));
const add = (label: string) => {
  const element = document.createElement('button');
  element.textContent = label;
  starters.appendChild(element);
  bounds(element);
  return element;
};
beforeEach(() => {
  root = document.createElement('section');
  root.setAttribute('role', 'region');
  starters = document.createElement('div');
  starters.className = anchors.starterList;
  composer = document.createElement('div');
  composer.className = anchors.composer;
  root.append(starters, composer);
  document.body.appendChild(root);
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    1280,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    800,
  );
  bounds(composer, 350, 400, 560, 96);
});
afterEach(() => {
  root.remove();
  vi.restoreAllMocks();
});
describe('invisible cat starter selection', () => {
  it('measures a focused composer even without starter anchors or buttons', () => {
    composer.style.borderRadius = '12px';
    const input = document.createElement('textarea');
    input.value = 'Unsent draft';
    composer.appendChild(input);
    input.focus();
    input.setSelectionRange(2, 5);
    const targets = getFootprintTargets({ composer: anchors.composer });
    expect(targets.composer).toMatchObject({
      element: composer,
      borderRadius: '12px',
    });
    expect(targets.card).toBeUndefined();
    expect(input.value).toBe('Unsent draft');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
  });
  it.each([false, true])(
    'borrows a starter below the composer in the real chat order, rtl=%s',
    (rtl) => {
      root.dir = rtl ? 'rtl' : 'ltr';
      root.prepend(composer);
      const starter = add('Below composer');
      bounds(starter, 560, 512);
      expect(getFootprintTargets(anchors).card?.element).toBe(starter);
    },
  );
  it('rejects a starter overlapping the composer or touching its edge', () => {
    const starter = add('Unsafe overlap');
    for (const y of [380, 430, 480, 496, 503]) {
      bounds(starter, 560, y);
      expect(getFootprintTargets(anchors).card).toBeUndefined();
    }
  });
  it('chooses the nearest gap without preferring starters above the composer', () => {
    bounds(add('Above'), 560, 270);
    const below = add('Below');
    bounds(below, 560, 512);
    expect(getFootprintTargets(anchors).card?.element).toBe(below);
  });
  it('borrows the nearest safe starter, never a composer control', () => {
    const far = add('Far');
    bounds(far, 150, 200);
    const near = add('Near');
    bounds(near, 560, 330);
    const send = document.createElement('button');
    composer.appendChild(send);
    bounds(send, 630, 410);
    const targets = getFootprintTargets(anchors);
    expect(targets.card?.element).toBe(near);
    expect(targets.composer?.element).toBe(composer);
    expect(send.getBoundingClientRect).not.toHaveBeenCalled();
  });
  it('skips focused, expanded, editable, disabled, hidden and oversized cards', () => {
    add('Focused').focus();
    add('Expanded').setAttribute('aria-expanded', 'true');
    add('Disabled').disabled = true;
    add('Editable').appendChild(document.createElement('input'));
    add('Hidden').hidden = true;
    add('Transparent').style.opacity = '0.5';
    bounds(add('Large'), 420, 280, 241, 44);
    bounds(add('Tall'), 420, 280, 140, 97);
    bounds(add('No headroom'), 420, 100);
    bounds(add('Over composer'), 420, 380);
    const deep = add('Complex');
    for (let i = 0; i < 41; i++)
      deep.appendChild(document.createElement('span'));
    const safe = add('Safe');
    expect(getFootprintTargets(anchors).card?.element).toBe(safe);
  });
  it('rejects clipped and transformed targets, including transformed ancestors', () => {
    const card = add('Card');
    starters.style.overflow = 'hidden';
    bounds(starters, 440, 250, 300, 100);
    expect(getFootprintTargets(anchors).card).toBeUndefined();
    starters.style.overflow = 'visible';
    card.style.transform = 'rotate(5deg)';
    expect(getFootprintTargets(anchors).card).toBeUndefined();
    card.style.transform = 'none';
    starters.style.scale = '0.9';
    expect(getFootprintTargets(anchors).card).toBeUndefined();
    starters.style.scale = 'none';
    starters.style.clipPath = 'circle(10px)';
    expect(getFootprintTargets(anchors).card).toBeUndefined();
    starters.style.clipPath = 'none';
    starters.style.filter = 'blur(2px)';
    expect(getFootprintTargets(anchors).card).toBeUndefined();
  });
  it('reserves enough of the mobile SVG budget for the cat artwork', () => {
    const complex = add('Complex icon');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (let i = 0; i < 12; i++)
      svg.appendChild(document.createElementNS(svg.namespaceURI, 'path'));
    complex.appendChild(svg);
    expect(getFootprintTargets(anchors).card).toBeUndefined();
    svg.lastElementChild!.remove();
    expect(getFootprintTargets(anchors).card?.element).toBe(complex);
  });
  it('bounds candidate scans and caches geometry reads within preparation', () => {
    for (let i = 0; i < 30; i++) add(String(i));
    getFootprintTargets(anchors);
    const measured = [...starters.children].filter(
      (e) => vi.mocked(e.getBoundingClientRect).mock.calls.length,
    );
    expect(measured).toHaveLength(FOOTPRINT_SCAN_LIMIT);
    for (const element of [composer, ...measured])
      expect(element.getBoundingClientRect).toHaveBeenCalledOnce();
  });
  it('falls back for missing anchors or insufficient card space', () => {
    add('Card');
    expect(getFootprintTargets({}).card).toBeUndefined();
    bounds(starters.firstElementChild!, 0, 280);
    expect(getFootprintTargets(anchors).card).toBeUndefined();
    composer.remove();
    expect(getFootprintTargets(anchors).card).toBeUndefined();
  });
});
