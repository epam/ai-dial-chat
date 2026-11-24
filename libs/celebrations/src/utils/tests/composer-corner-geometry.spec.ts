import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cornerRectsIntersect,
  getVisibleViewport,
  measureCornerTargets,
} from '../composer-corner-geometry';

describe('corner scene host geometry', () => {
  const element = (className: string, rect: DOMRect, tag = 'div') => {
    const node = document.createElement(tag);
    node.className = className;
    document.body.append(node);
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect);
    return node;
  };
  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      360,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      780,
    );
    vi.stubGlobal('visualViewport', undefined);
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('insets the layout viewport when visual viewport is unavailable', () => {
    expect(getVisibleViewport()).toEqual({
      left: 12,
      top: 20,
      right: 348,
      bottom: 760,
      width: 336,
      height: 740,
    });
  });
  it('uses the offset intersection rather than the larger layout viewport', () => {
    vi.stubGlobal('visualViewport', {
      offsetLeft: 30,
      offsetTop: 70,
      width: 300,
      height: 380,
    });
    expect(getVisibleViewport()).toEqual({
      left: 42,
      top: 90,
      right: 318,
      bottom: 430,
      width: 276,
      height: 340,
    });
  });
  it.each([
    { offsetLeft: 0, offsetTop: 0, width: NaN, height: 500 },
    { offsetLeft: 0, offsetTop: 0, width: 10, height: 500 },
    { offsetLeft: 0, offsetTop: 900, width: 360, height: 500 },
  ])('rejects an unusable viewport %j', (viewport) => {
    vi.stubGlobal('visualViewport', viewport);
    expect(getVisibleViewport()).toBeNull();
  });
  it('permits touching borders and rejects positive-area overlap', () => {
    const a = new DOMRect(0, 0, 20, 20);
    expect(cornerRectsIntersect(a, new DOMRect(20, 0, 20, 20))).toBe(false);
    expect(cornerRectsIntersect(a, new DOMRect(0, 20, 20, 20))).toBe(false);
    expect(cornerRectsIntersect(a, new DOMRect(19, 0, 20, 20))).toBe(true);
  });
  it('protects visible composers even when too small, tall or close to the viewport edge for animation', () => {
    const composer = element('composer', new DOMRect(0, 480, 80, 300));
    const measured = measureCornerTargets({ composer: 'composer' });
    expect(measured?.composers[0].element).toBe(composer);
    expect(measured?.protectedTargets[0].rect).toEqual(
      new DOMRect(0, 480, 80, 300),
    );
    expect(measured?.watched[0].rect).toBe(measured?.composers[0].rect);
    expect(composer.getBoundingClientRect).toHaveBeenCalledOnce();
  });
  it('protects the full measured rectangle of a partly clipped input', () => {
    const composer = element('composer', new DOMRect(16, 600, 328, 160));
    const parent = element('clip', new DOMRect(0, 0, 360, 700));
    parent.style.overflowY = 'hidden';
    parent.append(composer);
    const target = measureCornerTargets({ composer: 'composer' })?.composers[0];
    expect(target?.isClipped).toBe(true);
    expect(target?.rect.bottom).toBe(760);
  });
  it('excludes hidden ancestors and completely clipped targets', () => {
    const composer = element('composer', new DOMRect(16, 600, 328, 160));
    const parent = element('clip', new DOMRect(0, 0, 360, 500));
    parent.style.overflowY = 'hidden';
    parent.append(composer);
    expect(measureCornerTargets({ composer: 'composer' })?.composers).toEqual(
      [],
    );
    parent.style.overflowY = 'visible';
    parent.hidden = true;
    expect(measureCornerTargets({ composer: 'composer' })?.composers).toEqual(
      [],
    );
  });
  it('watches hidden and zero-size supplied controls without protecting their rectangles', () => {
    const composer = element('composer', new DOMRect(16, 600, 328, 72));
    const hidden = element('model', new DOMRect(16, 400, 200, 40));
    hidden.hidden = true;
    const empty = element('attach', new DOMRect());
    const targets = measureCornerTargets({
      composer: 'composer',
      composerModelSelector: 'model',
      composerAddCluster: 'attach',
    });
    expect(targets?.protectedTargets.map(({ element: node }) => node)).toEqual([
      composer,
    ]);
    expect(targets?.watched.map(({ element: node }) => node)).toEqual([
      composer,
      empty,
      hidden,
    ]);
  });
  it('detects missing supplied controls mounting without a new layout read', () => {
    const composer = element('composer', new DOMRect(16, 600, 328, 72));
    const targets = measureCornerTargets({
      composer: 'composer',
      composerModelSelector: 'model',
    });
    expect(targets?.hasTargetSetChanged()).toBe(false);
    const model = element('model', new DOMRect(16, 400, 200, 40));
    expect(targets?.hasTargetSetChanged()).toBe(true);
    expect(composer.getBoundingClientRect).toHaveBeenCalledOnce();
    expect(model.getBoundingClientRect).not.toHaveBeenCalled();
  });
  it('detects membership renaming and over-budget additions with bounded comparisons', () => {
    const composer = element('composer', new DOMRect(16, 600, 328, 72));
    const targets = measureCornerTargets({ composer: 'composer' });
    composer.className = 'removed-composer';
    expect(targets?.hasTargetSetChanged()).toBe(true);
    composer.className = 'composer';
    expect(targets?.hasTargetSetChanged()).toBe(false);
    for (let i = 0; i < 5; i++) element('composer', new DOMRect());
    expect(targets?.hasTargetSetChanged()).toBe(true);
    expect(composer.getBoundingClientRect).toHaveBeenCalledOnce();
  });
  it('finds the first visible heading and protects the whole starter list in an optional region', () => {
    const region = element('welcome', new DOMRect(0, 0, 360, 780), 'main');
    region.setAttribute('role', 'region');
    const composer = element('composer', new DOMRect(16, 600, 328, 72));
    const hidden = element('', new DOMRect(16, 300, 300, 40), 'h1');
    hidden.hidden = true;
    const heading = element('', new DOMRect(16, 400, 300, 40), 'h2');
    const starters = element('starters', new DOMRect(16, 500, 328, 60));
    region.append(hidden, heading, starters, composer);
    const targets = measureCornerTargets({
      composer: 'composer',
      starterList: 'starters',
    });
    expect(
      targets?.protectedTargets.map(({ element: target }) => target),
    ).toEqual([composer, heading, starters]);
    expect(
      targets?.watched.some(({ element: target }) => target === region),
    ).toBe(true);
    expect(heading.getBoundingClientRect).toHaveBeenCalledOnce();
  });
  it('does not search unrelated page headings for a docked composer', () => {
    const composer = element('composer', new DOMRect(16, 600, 328, 72));
    const unrelated = element('', new DOMRect(16, 400, 300, 40), 'h1');
    expect(
      measureCornerTargets({ composer: 'composer' })?.protectedTargets.map(
        ({ element: target }) => target,
      ),
    ).toEqual([composer]);
    expect(unrelated.getBoundingClientRect).not.toHaveBeenCalled();
  });
  it('can protect an explicitly supplied region even without a composer', () => {
    const region = element('welcome', new DOMRect(0, 0, 360, 780), 'main');
    const heading = element('', new DOMRect(16, 400, 300, 40), 'h1');
    region.append(heading);
    const targets = measureCornerTargets({ welcomeRegion: '.welcome' });
    expect(targets?.composers).toEqual([]);
    expect(targets?.protectedTargets[0].element).toBe(heading);
  });
  it('fails closed for malformed selectors, target geometry or an excessive discovery budget', () => {
    expect(measureCornerTargets({ welcomeRegion: '[' })).toBeNull();
    const composer = element('composer', new DOMRect(NaN, 400, 300, 72));
    expect(measureCornerTargets({ composer: 'composer' })).toBeNull();
    composer.remove();
    for (let i = 0; i < 5; i++)
      element('composer', new DOMRect(16, 400, 300, 72));
    expect(measureCornerTargets({ composer: 'composer' })).toBeNull();
  });
  it('rejects an ancestry chain beyond the finite scan', () => {
    const composer = element('composer', new DOMRect(16, 400, 300, 72));
    let parent: HTMLElement = document.body;
    for (let i = 0; i < 25; i++) {
      const next = document.createElement('div');
      parent.append(next);
      parent = next;
    }
    parent.append(composer);
    expect(measureCornerTargets({ composer: 'composer' })).toBeNull();
  });
});
