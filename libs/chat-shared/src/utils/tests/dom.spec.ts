import { afterEach, describe, expect, it } from 'vitest';
import { makeOutsideInert } from '../dom';

describe('makeOutsideInert', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const append = (label: string) => {
    const element = document.createElement('div');
    element.setAttribute('aria-label', label);
    document.body.append(element);
    return element;
  };

  it('makes the other body children inert and restores them', () => {
    const page = append('page');
    const overlayHost = append('overlay host');
    const overlay = document.createElement('div');
    overlayHost.append(overlay);

    const restore = makeOutsideInert(overlay);

    expect(page.hasAttribute('inert')).toBe(true);
    expect(overlayHost.hasAttribute('inert')).toBe(false);

    restore();

    expect(page.hasAttribute('inert')).toBe(false);
  });

  it('leaves a child that was already inert inert', () => {
    const page = append('page');
    page.setAttribute('inert', '');
    const overlay = append('overlay');

    makeOutsideInert(overlay)();

    expect(page.hasAttribute('inert')).toBe(true);
  });
});
