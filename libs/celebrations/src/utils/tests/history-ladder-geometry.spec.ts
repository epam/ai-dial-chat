import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELEBRATIONS_CLASS } from '../../constants/public-class-names';
import type { CornerRect } from '../../models/composer-corner';
import type { HistoryLadderGeometryOptions } from '../../models/history-ladder';
import {
  HistoryLadderAnchor,
  HistoryLadderMode,
} from '../../types/history-ladder';
import { cornerRectsIntersect } from '../composer-corner-geometry';
import { resolveHistoryLadderGeometry } from '../history-ladder-geometry';

const names = Object.values(HistoryLadderAnchor);
const rect = (left: number, top: number, width: number, height: number) =>
  new DOMRect(left, top, width, height);
const references = Object.fromEntries(
  names.map((name, index) => [name, { x: 200, y: 100 + index * 40 }]),
);
const bounds: Readonly<Record<string, CornerRect>> = Object.fromEntries(
  names.map((name, index) => [name, rect(170, 60 + index * 40, 60, 50)]),
);

describe('history ladder geometry', () => {
  let composer: HTMLElement;
  let history: HTMLElement;
  let rows: HTMLElement[];
  const measured = (tag: string, bounds: DOMRect, className = '') => {
    const element = document.createElement(tag);
    element.className = className;
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(bounds);
    return element;
  };
  const options = (
    overrides: Partial<HistoryLadderGeometryOptions> = {},
  ): HistoryLadderGeometryOptions => ({
    anchors: {
      composer: 'composer',
      historyContainer: 'history',
      historyRowLink: 'a',
    },
    direction: 'ltr',
    references,
    bounds,
    maxGap: 80,
    maxDrift: 24,
    copyAnchor: HistoryLadderAnchor.Row2,
    ...overrides,
  });
  const prepare = (overrides: Partial<HistoryLadderGeometryOptions> = {}) =>
    resolveHistoryLadderGeometry(options(overrides));
  const addRows = (count: number, spacing = 40) => {
    history.replaceChildren();
    rows = Array.from({ length: count }, (_, index) => {
      const row = measured('li', rect(32, 120 + index * spacing, 268, 32));
      const link = document.createElement('a');
      link.href = `#conversation-${index}`;
      link.textContent = `Conversation ${index}`;
      row.append(link);
      history.append(row);
      return row;
    });
  };

  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      900,
    );
    vi.stubGlobal('visualViewport', undefined);
    composer = measured('div', rect(500, 700, 600, 60), 'composer');
    history = measured('ul', rect(20, 100, 300, 500), 'history');
    document.body.append(history, composer);
    addRows(6);
  });

  afterEach(() => {
    document.body.replaceChildren();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('maps six row-top edges once and borrows only the requested station', () => {
    const plan = prepare({ copyAnchor: HistoryLadderAnchor.Row4 });
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(plan?.points).toEqual(
      Object.fromEntries(
        names.map((name, index) => [name, { x: 300, y: 120 + index * 40 }]),
      ),
    );
    expect(plan?.copy?.element).toBe(rows[4]);
    expect(plan?.width).toBe(1280);
    expect(plan?.height).toBe(900);
    expect(
      rows.every(
        (row) => vi.mocked(row.getBoundingClientRect).mock.calls.length === 1,
      ),
    ).toBe(true);
    expect(plan?.watched.some(({ element }) => element === history)).toBe(true);
    expect(
      plan?.watched.filter(({ element }) =>
        rows.includes(element as HTMLElement),
      ),
    ).toHaveLength(6);
  });

  it('includes first and last rows while distributing six stations over a longer visible list', () => {
    addRows(11);
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(names.map((name) => plan?.points[name].y)).toEqual([
      120, 200, 280, 360, 440, 520,
    ]);
    expect(plan?.copy?.element).toBe(rows[4]);
  });

  const realListOptions = (): Partial<HistoryLadderGeometryOptions> => ({
    references: Object.fromEntries(
      names.map((name, index) => [name, { x: 176, y: 110 + index * 44 }]),
    ),
    bounds: Object.fromEntries(
      names.map((name, index) => [
        name,
        index === 5
          ? rect(26, 103, 306, 310)
          : index === 1
            ? rect(152, 49, 86, 181)
            : rect(152, 5 + index * 44, 86, 120),
      ]),
    ),
  });
  const addRealListRows = () => {
    addRows(16, 34);
    for (const [index, row] of rows.entries())
      vi.mocked(row.getBoundingClientRect).mockReturnValue(
        rect(16, 386 + index * 34, 304, 32),
      );
    history.prepend(measured('button', rect(270, 300, 80, 116)));
  };

  it('keeps the lowest ending row and uses a later reachable start in a long 34px list', () => {
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      1080,
    );
    addRealListRows();
    const plan = prepare(realListOptions());
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(names.map((name) => plan?.points[name].y)).toEqual([
      556, 624, 692, 760, 828, 896,
    ]);
    expect(plan?.copy?.element).toBe(rows[9]);
  });

  it('trims a visible trailing row whose authored ending would leave the viewport', () => {
    addRealListRows();
    const plan = prepare(realListOptions());
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(plan?.points[HistoryLadderAnchor.Row0].y).toBe(522);
    expect(plan?.points[HistoryLadderAnchor.Row5].y).toBe(794);
    expect(plan?.watched.some(({ element }) => element === rows[13])).toBe(
      false,
    );
  });

  it('tries another reachable corridor without accepting an unsafe copy path', () => {
    addRows(11);
    const isCopyPathSafe = vi
      .fn<NonNullable<HistoryLadderGeometryOptions['isCopyPathSafe']>>()
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const plan = prepare({ isCopyPathSafe });
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(isCopyPathSafe).toHaveBeenCalledTimes(2);
    expect(plan?.points[HistoryLadderAnchor.Row0].y).toBe(160);
    expect(plan?.points[HistoryLadderAnchor.Row5].y).toBe(520);
  });

  it('bounds expensive copy checks to 24 and never remeasures rows while searching', () => {
    addRows(30, 20);
    for (const [index, row] of rows.entries())
      vi.mocked(row.getBoundingClientRect).mockReturnValue(
        rect(32, 120 + index * 20, 268, 16),
      );
    const isCopyPathSafe = vi.fn<
      NonNullable<HistoryLadderGeometryOptions['isCopyPathSafe']>
    >(() => false);
    const plan = prepare({ isCopyPathSafe });
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(isCopyPathSafe).toHaveBeenCalledTimes(24);
    expect(
      rows.every(
        (row) => vi.mocked(row.getBoundingClientRect).mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it('can use history without a composer and mirrors native station offsets in RTL', () => {
    composer.remove();
    for (const [index, row] of rows.entries())
      vi.mocked(row.getBoundingClientRect).mockReturnValue(
        rect(980, 120 + index * 40, 268, 32),
      );
    const plan = prepare({ direction: 'rtl' });
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(plan?.points[HistoryLadderAnchor.Row0]).toEqual({ x: 980, y: 120 });
    expect(plan?.side).toBe(-1);
    expect(rows[2].style.transform).toBe('');
    expect(rows[2].querySelector('a')?.getAttribute('href')).toBe(
      '#conversation-2',
    );
  });

  it('uses a complete translated drawn route when history is absent', () => {
    history.remove();
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(plan?.copy).toBeUndefined();
    const first = plan?.points[HistoryLadderAnchor.Row0];
    expect(first).toEqual({ x: 1070, y: 478 });
    expect(plan?.points[HistoryLadderAnchor.Row5].y).toBe(
      (first?.y ?? 0) + 200,
    );
  });

  it('places the drawn route above a narrow composer without shrinking its authored spacing', () => {
    history.hidden = true;
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      360,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      780,
    );
    vi.mocked(composer.getBoundingClientRect).mockReturnValue(
      rect(12, 650, 336, 72),
    );
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(plan?.points[HistoryLadderAnchor.Row0]).toEqual({ x: 318, y: 428 });
    expect(plan?.points[HistoryLadderAnchor.Row5]).toEqual({ x: 318, y: 628 });
  });

  it('falls back when actual gaps or horizontal drift exceed authored reach', () => {
    addRows(6, 90);
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    addRows(6);
    vi.mocked(rows[3].getBoundingClientRect).mockReturnValue(
      rect(60, 240, 268, 32),
    );
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it('finds the nearby free area above a phone welcome heading and keeps authored scale', () => {
    history.remove();
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      360,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      780,
    );
    vi.mocked(composer.getBoundingClientRect).mockReturnValue(
      rect(12, 650, 336, 72),
    );
    const welcome = measured('main', rect(0, 0, 360, 780));
    welcome.setAttribute('role', 'region');
    const heading = measured('h1', rect(12, 550, 336, 40));
    welcome.append(heading, composer);
    document.body.append(welcome);
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(plan?.points[HistoryLadderAnchor.Row0]).toEqual({ x: 318, y: 328 });
    expect(plan?.points[HistoryLadderAnchor.Row5]).toEqual({ x: 318, y: 528 });
    expect(plan?.watched.some(({ element }) => element === heading)).toBe(true);
    vi.stubGlobal('visualViewport', {
      offsetLeft: 0,
      offsetTop: 380,
      width: 360,
      height: 400,
    });
    expect(prepare()).toBeNull();
  });

  it('rejects overlapping support rows', () => {
    addRows(6, 20);
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it.each(['focus', 'editable', 'expanded', 'hidden', 'transform', 'hover'])(
    'skips a %s row without borrowing it',
    (state) => {
      if (state === 'focus') rows[2].querySelector('a')?.focus();
      if (state === 'editable') rows[2].append(document.createElement('input'));
      if (state === 'expanded') rows[2].setAttribute('aria-expanded', 'true');
      if (state === 'hidden') rows[2].hidden = true;
      if (state === 'transform') rows[2].style.transform = 'translateX(1px)';
      if (state === 'hover') {
        const original = rows[2].matches.bind(rows[2]);
        vi.spyOn(rows[2], 'matches').mockImplementation(
          (selector) => selector === ':hover' || original(selector),
        );
      }
      expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
      expect(rows[2].style.opacity).toBe('');
    },
  );

  it('skips rows running an animation', () => {
    Object.defineProperty(rows[2], 'getAnimations', {
      configurable: true,
      value: () => [{ playState: 'running', pending: false }],
    });
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it('uses real-style rows with decorative aria-hidden indicators and action glyphs', () => {
    for (const row of rows) {
      const dot = document.createElement('span');
      dot.setAttribute('aria-hidden', 'true');
      dot.append(document.createElement('span'));
      row.querySelector('a')?.prepend(dot);
      const button = document.createElement('button');
      button.setAttribute('aria-expanded', 'false');
      const icon = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      );
      icon.setAttribute('aria-hidden', 'true');
      icon.append(
        document.createElementNS('http://www.w3.org/2000/svg', 'path'),
      );
      button.append(icon);
      row.append(button);
    }
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(plan?.copy?.element).toBe(rows[2]);
  });

  it.each(['button', 'link', 'custom-control', 'wrapped-control'])(
    'rejects an aria-hidden %s without discarding hidden-control safety',
    (kind) => {
      const hidden = document.createElement(
        kind === 'button' ? 'button' : 'span',
      );
      hidden.setAttribute('aria-hidden', 'true');
      if (kind === 'link') {
        const link = document.createElement('a');
        link.href = '#hidden-action';
        hidden.append(link);
      }
      if (kind === 'custom-control') hidden.setAttribute('role', 'button');
      if (kind === 'wrapped-control') {
        const wrapper = document.createElement('span');
        wrapper.setAttribute('aria-hidden', 'false');
        wrapper.append(document.createElement('button'));
        hidden.append(wrapper);
      }
      rows[2].append(hidden);
      expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    },
  );

  it.each(['row', 'history'])(
    'continues to reject an aria-hidden %s itself',
    (target) => {
      (target === 'row' ? rows[2] : history).setAttribute(
        'aria-hidden',
        'true',
      );
      expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    },
  );

  it.each(['hidden', 'inert', 'data-celebration-snapshot'])(
    'does not treat a %s descendant as decorative',
    (attribute) => {
      const decoration = document.createElement('span');
      decoration.setAttribute('aria-hidden', 'true');
      decoration.setAttribute(attribute, '');
      rows[2].append(decoration);
      expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    },
  );

  it.each(['iframe', 'embed', 'object', 'details', 'label'])(
    'rejects an aria-hidden %s as more than decoration',
    (tag) => {
      const embedded = document.createElement(tag);
      embedded.setAttribute('aria-hidden', 'true');
      rows[2].append(embedded);
      expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    },
  );

  it('rejects ancestor clipping and scale', () => {
    history.style.overflowY = 'hidden';
    vi.mocked(history.getBoundingClientRect).mockReturnValue(
      rect(20, 140, 300, 500),
    );
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    history.style.overflowY = 'visible';
    history.style.transform = 'scale(1.1)';
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it.each([0, 48])(
    'uses rows inside a virtual-list wrapper translated by %s pixels',
    (offset) => {
      const wrapper = measured('div', rect(20, 100 + offset, 300, 500));
      wrapper.style.transform = `translateY(${offset}px)`;
      wrapper.append(...rows);
      history.append(wrapper);
      for (const [index, row] of rows.entries())
        vi.mocked(row.getBoundingClientRect).mockReturnValue(
          rect(32, 120 + offset + index * 40, 268, 32),
        );
      /* Browsers expose translateY as a computed matrix. jsdom keeps the input. */
      const getStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        const style = getStyle(element);
        if (element === wrapper) {
          const read = style.getPropertyValue.bind(style);
          vi.spyOn(style, 'getPropertyValue').mockImplementation((name) =>
            name === 'transform'
              ? `matrix(1, 0, 0, 1, 0, ${offset})`
              : read(name),
          );
        }
        return style;
      });
      const plan = prepare();
      expect(plan?.mode).toBe(HistoryLadderMode.History);
      expect(plan?.points[HistoryLadderAnchor.Row0].y).toBe(120 + offset);
      expect(plan?.copy?.rect.top).toBe(200 + offset);
    },
  );

  it.each([
    ['transform', 'matrix(1, 0, 0, 1, 12, -30)'],
    [
      'transform',
      'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, -30, 0, 1)',
    ],
    ['translate', '12px -30px'],
    ['translate', '0px 10% 0px'],
  ])('accepts only planar ancestor %s: %s', (property, value) => {
    history.style.setProperty(property, value);
    expect(prepare()?.mode).toBe(HistoryLadderMode.History);
  });

  it.each([
    ['transform', 'matrix(1, 0, 0, 1, 12, 0)'],
    ['translate', '12px 0px'],
  ])("still rejects a row's own %s", (property, value) => {
    rows[2].style.setProperty(property, value);
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it.each(['body', 'html'])(
    'rejects a translated %s that would offset the fixed scene twice',
    (tag) => {
      const ancestor =
        tag === 'body' ? document.body : document.documentElement;
      ancestor.style.transform = 'matrix(1, 0, 0, 1, 20, 30)';
      expect(prepare()).toBeNull();
      ancestor.style.transform = '';
      ancestor.style.setProperty('translate', '20px 30px');
      expect(prepare()).toBeNull();
    },
  );

  it('allows translated row wrappers only when the scene does not share their offset', () => {
    const wrapper = measured('div', rect(20, 100, 300, 500));
    wrapper.style.transform = 'matrix(1, 0, 0, 1, 0, 48)';
    wrapper.append(...rows);
    history.append(wrapper);
    const scene = measured(
      'div',
      rect(0, 0, 1280, 900),
      CELEBRATIONS_CLASS.sceneLayer,
    );
    document.body.append(scene);
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(plan?.watched.some(({ element }) => element === scene)).toBe(true);
    wrapper.append(scene);
    expect(prepare()).toBeNull();
  });

  it('retains viewport and scroll-container clipping for translated wrappers', () => {
    history.style.transform = 'matrix(1, 0, 0, 1, 0, -80)';
    history.style.overflowY = 'auto';
    for (const [index, row] of rows.entries())
      vi.mocked(row.getBoundingClientRect).mockReturnValue(
        rect(32, 40 + index * 40, 268, 32),
      );
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    history.style.overflowY = 'visible';
    vi.mocked(rows[0].getBoundingClientRect).mockReturnValue(
      rect(32, 10, 268, 32),
    );
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it.each([
    ['running', false],
    ['paused', true],
  ])(
    'rejects an ancestor with a %s or pending animation',
    (playState, pending) => {
      history.style.transform = 'matrix(1, 0, 0, 1, 0, 48)';
      const getAnimations = vi.fn(() => [{ playState, pending }]);
      Object.defineProperty(history, 'getAnimations', { value: getAnimations });
      expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
      expect(getAnimations).toHaveBeenCalledOnce();
      expect(getAnimations).toHaveBeenCalledWith();
    },
  );

  it('allows a settled translated ancestor and reads its animation state once', () => {
    history.style.transform = 'matrix(1, 0, 0, 1, 0, 48)';
    const getAnimations = vi.fn(() => [
      { playState: 'finished', pending: false },
    ]);
    Object.defineProperty(history, 'getAnimations', { value: getAnimations });
    expect(prepare()?.mode).toBe(HistoryLadderMode.History);
    expect(getAnimations).toHaveBeenCalledOnce();
  });

  it.each([
    ['transform', 'matrix(1.1, 0, 0, 1, 0, 48)'],
    ['transform', 'matrix(1, 0.2, 0, 1, 0, 48)'],
    ['transform', 'matrix(0, 1, -1, 0, 0, 48)'],
    ['transform', 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 48, 1, 1)'],
    ['translate', '0px 48px 1px'],
  ])('rejects non-planar or distorted ancestor %s: %s', (property, value) => {
    history.style.setProperty(property, value);
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it.each([
    ['rotate', '10deg'],
    ['scale', '1.1'],
    ['perspective', '500px'],
    ['zoom', '1.1'],
  ])(
    'rejects individual ancestor %s that a snapshot would otherwise apply twice',
    (property, value) => {
      history.style.setProperty(property, value);
      /* jsdom does not compute CSS zoom; provide the browser's computed value. */
      if (property === 'zoom') {
        const getStyle = window.getComputedStyle.bind(window);
        vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
          const style = getStyle(element);
          if (element === history) {
            const read = style.getPropertyValue.bind(style);
            vi.spyOn(style, 'getPropertyValue').mockImplementation((name) =>
              name === 'zoom' ? value : read(name),
            );
          }
          return style;
        });
      }
      expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    },
  );

  it('bounds descendant counting before measuring or copying an oversized row', () => {
    for (let i = 0; i < 79; i++) rows[2].append(document.createElement('span'));
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    expect(rows[2].getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('limits the selected copy size independently of its station spacing', () => {
    vi.mocked(rows[2].getBoundingClientRect).mockReturnValue(
      rect(32, 200, 321, 32),
    );
    expect(prepare({ maxDrift: 100 })?.mode).toBe(HistoryLadderMode.Drawn);
    vi.mocked(rows[2].getBoundingClientRect).mockReturnValue(
      rect(32, 200, 268, 65),
    );
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it('stops before row measurement when link discovery exceeds its budget', () => {
    addRows(121, 2);
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
    expect(
      rows.every(
        (row) => vi.mocked(row.getBoundingClientRect).mock.calls.length === 0,
      ),
    ).toBe(true);
  });

  it('protects sidebar controls outside rows and watches their geometry', () => {
    const button = measured('button', rect(270, 90, 80, 25));
    history.prepend(button);
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(plan?.watched.some(({ element }) => element === button)).toBe(true);
  });

  it('starts at the first row with actor headroom while retaining the last eligible row', () => {
    addRows(8);
    const heading = measured('h2', rect(260, 70, 80, 50));
    history.prepend(heading);
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.History);
    expect(plan?.points[HistoryLadderAnchor.Row0].y).toBe(160);
    expect(plan?.points[HistoryLadderAnchor.Row5].y).toBe(400);
    expect(plan?.watched.some(({ element }) => element === heading)).toBe(true);
    addRows(6);
    history.prepend(heading);
    expect(prepare()?.mode).toBe(HistoryLadderMode.Drawn);
  });

  it('ignores drawn-only bounds for history but includes them in synthetic placement', () => {
    const drawnBounds = rect(170, 60, 330, 250);
    expect(prepare({ drawnBounds })?.mode).toBe(HistoryLadderMode.History);
    history.remove();
    const plan = prepare({ drawnBounds });
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(plan?.points[HistoryLadderAnchor.Row0]).toEqual({ x: 800, y: 478 });
    expect(prepare({ drawnBounds: rect(0, 60, 1300, 250) })).toBeNull();
  });

  it('mirrors a drawn-only envelope around the same origin as the native references', () => {
    history.remove();
    const plan = prepare({
      direction: 'rtl',
      drawnBounds: rect(170, 60, 330, 250),
    });
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(plan?.side).toBe(-1);
    expect(plan?.points[HistoryLadderAnchor.Row0]).toEqual({ x: 800, y: 478 });
  });

  it('allows the controls inside a selected row to move only as its inert copy', () => {
    const button = measured('button', rect(280, 200, 20, 32));
    rows[2].append(button);
    expect(prepare()?.mode).toBe(HistoryLadderMode.History);
    expect(button.getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('rejects an unsafe band between otherwise clear station envelopes', () => {
    const sparseBounds = Object.fromEntries(
      names.map((name, index) => [name, rect(195, 95 + index * 40, 10, 10)]),
    );
    const control = measured('button', rect(295, 140, 10, 5), 'model');
    document.body.append(control);
    expect(
      prepare({
        bounds: sparseBounds,
        anchors: { ...options().anchors, composerModelSelector: 'model' },
      })?.mode,
    ).toBe(HistoryLadderMode.Drawn);
  });

  it('checks the actual copy path once and reuses measured host data for the drawn fallback', () => {
    const isCopyPathSafe = vi.fn<
      NonNullable<HistoryLadderGeometryOptions['isCopyPathSafe']>
    >(() => false);
    const plan = prepare({ isCopyPathSafe });
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(isCopyPathSafe).toHaveBeenCalledOnce();
    expect(isCopyPathSafe.mock.calls[0]?.[0]).toBeDefined();
    expect(
      rows.every(
        (row) => vi.mocked(row.getBoundingClientRect).mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it('detects container replacement and newly mounted semantic anchors without layout reads', () => {
    const plan = prepare();
    const reads = rows.map(
      (row) => vi.mocked(row.getBoundingClientRect).mock.calls.length,
    );
    expect(plan?.hasTargetSetChanged()).toBe(false);
    history.className = 'closed-history';
    expect(plan?.hasTargetSetChanged()).toBe(true);
    expect(
      rows.map((row) => vi.mocked(row.getBoundingClientRect).mock.calls.length),
    ).toEqual(reads);
  });

  it('returns no route when neither history nor the full drawn plot fits', () => {
    history.remove();
    vi.stubGlobal('visualViewport', {
      offsetLeft: 0,
      offsetTop: 600,
      width: 1280,
      height: 220,
    });
    expect(prepare()).toBeNull();
    composer.remove();
    expect(prepare()).toBeNull();
  });

  it('fails closed for invalid metadata and excess sidebar controls', () => {
    expect(prepare({ maxGap: NaN })).toBeNull();
    expect(prepare({ copyAnchor: 'row-6' })).toBeNull();
    for (let i = 0; i < 17; i++)
      history.prepend(measured('button', rect(20, 40, 30, 20)));
    expect(prepare()).toBeNull();
  });

  it('keeps later sidebar controls protected when another container exceeds the row budget', () => {
    addRows(121, 2);
    const second = measured('aside', rect(1000, 400, 200, 300), 'history');
    const control = measured('button', rect(1040, 438, 60, 250));
    second.append(control);
    document.body.append(second);
    const plan = prepare();
    expect(plan?.mode).toBe(HistoryLadderMode.Drawn);
    expect(plan?.watched.some(({ element }) => element === control)).toBe(true);
    const first = plan?.points[HistoryLadderAnchor.Row0];
    expect(first).toBeDefined();
    expect(
      cornerRectsIntersect(
        rect((first?.x ?? 0) - 30, (first?.y ?? 0) - 40, 60, 250),
        rect(1040, 438, 60, 250),
      ),
    ).toBe(false);
  });

  it('fails closed rather than ignoring an over-budget semantic history container', () => {
    for (let index = 0; index < 4; index++)
      document.body.append(measured('ul', rect(20, 100, 300, 500), 'history'));
    expect(prepare()).toBeNull();
  });
});
