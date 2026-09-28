import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWitchTargets, WITCH_SCAN_LIMIT } from '../halloween-witch-targets';

let root: HTMLElement;
let composer: HTMLElement;
const anchors = { composer: 'witch-composer', starterList: 'witch-starters' };
const rect = (
  element: HTMLElement,
  x: number,
  y: number,
  width = 80,
  height = 40,
) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(x, y, width, height));
const add = (label: string) => {
  const button = document.createElement('button');
  button.textContent = label;
  composer.appendChild(button);
  rect(button, 420 + composer.children.length * 5, 390);
  return button;
};
beforeEach(() => {
  root = document.createElement('section');
  root.setAttribute('role', 'region');
  composer = document.createElement('div');
  composer.className = anchors.composer;
  root.appendChild(composer);
  document.body.appendChild(root);
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    1280,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    800,
  );
  rect(composer, 350, 300, 600, 160);
});
afterEach(() => {
  root.remove();
  vi.restoreAllMocks();
});
describe('witch target eligibility', () => {
  it('selects two desktop or one mobile button without copying the composer', () => {
    add('Attach');
    add('Model');
    add('Tools');
    expect(getWitchTargets(anchors, false).buttons).toHaveLength(2);
    expect(getWitchTargets(anchors, true).buttons).toHaveLength(1);
    expect(getWitchTargets(anchors, false).composer?.element).toBe(composer);
  });
  it('skips focused, expanded, editable, hidden, clipped, disabled and oversized controls', () => {
    add('Focused').focus();
    add('Expanded').setAttribute('aria-expanded', 'true');
    add('Disabled').disabled = true;
    add('Hidden').style.display = 'none';
    add('Editable').appendChild(document.createElement('input'));
    const large = add('Large');
    rect(large, 420, 390, 241, 40);
    const deep = add('Deep');
    for (let i = 0; i < 41; i++)
      deep.appendChild(document.createElement('span'));
    const outside = add('Outside');
    rect(outside, -10, 390);
    const good = add('Safe');
    const result = getWitchTargets(anchors, false);
    expect(result.buttons.map((button) => button.element)).toEqual([good]);
    composer.style.overflow = 'hidden';
    rect(good, 349, 390);
    expect(getWitchTargets(anchors, false).buttons).toEqual([]);
  });
  it('bounds candidate traversal and reads each measured rectangle once', () => {
    for (let i = 0; i < 30; i++) add(String(i));
    const result = getWitchTargets(anchors, false);
    expect(result.buttons.length).toBeLessThanOrEqual(2);
    const measured = Array.from(composer.children).filter(
      (element) => vi.mocked(element.getBoundingClientRect).mock.calls.length,
    );
    expect(measured.length).toBeLessThanOrEqual(WITCH_SCAN_LIMIT);
    for (const element of [composer, ...measured])
      expect(element.getBoundingClientRect).toHaveBeenCalledOnce();
  });
  it('returns no targets when the host supplies no composer', () => {
    add('Safe');
    expect(getWitchTargets({}, false).buttons).toEqual([]);
  });
});
