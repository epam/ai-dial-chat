import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testAnchors } from '../../../test-utils/environment';
import {
  BAT_SURFACE_NODE_LIMIT,
  getBatTargets,
} from '../halloween-bat-targets';

let fixture: HTMLElement;
const place = (
  element: Element,
  left: number,
  top: number,
  width = 120,
  height = 40,
) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(left, top, width, height));
const composer = () => fixture.querySelector<HTMLElement>('.composer')!;
const welcome = () => fixture.querySelector<HTMLElement>('[role="region"]')!;
const starters = () => fixture.querySelector<HTMLElement>('.starters')!;
const addButton = (
  container: Element,
  left: number,
  top: number,
  width = 90,
  height = 32,
) => {
  const button = document.createElement('button');
  button.textContent = 'Button';
  container.appendChild(button);
  place(button, left, top, width, height);
  return button;
};
const addRow = (index: number, left = 20, top = 460) => {
  const row = document.createElement('li');
  row.innerHTML = `<a href="/conversations/${index}">Conversation ${index}</a>`;
  fixture.querySelector('ul')!.appendChild(row);
  place(row, left, top, 240, 40);
  return row;
};
const surfaces = (limit = 5) =>
  getBatTargets(
    testAnchors({ composer: 'composer', starterList: 'starters' }),
    limit,
  ).surfaces.map(({ element }) => element);

beforeEach(() => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    1280,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    900,
  );
  fixture = document.createElement('div');
  fixture.innerHTML =
    '<ul class="celebration-history"></ul><section role="region"><h1>Welcome</h1><div class="composer"><textarea></textarea></div><div class="starters"></div><div data-halloween-pumpkin-anchor><button>Pumpkin</button></div></section>';
  document.body.appendChild(fixture);
  place(composer(), 350, 300, 600, 180);
  place(welcome().querySelector('h1')!, 480, 150, 300, 50);
  place(
    welcome().querySelector('[data-halloween-pumpkin-anchor] button')!,
    620,
    520,
    90,
    90,
  );
});

afterEach(() => {
  fixture.remove();
  vi.restoreAllMocks();
});

describe('bat wind targets', () => {
  it('keeps the focused composer as an untouched anchor and reserves the nearest small perch', () => {
    const input = composer().querySelector('textarea')!;
    input.value = 'Unsent draft';
    input.focus();
    const perch = addButton(composer(), 610, 430);
    const control = addButton(composer(), 360, 430);
    const starter = addButton(starters(), 540, 560, 200, 64);
    const row = addRow(0);
    const before = fixture.innerHTML;
    const targets = getBatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(targets.composer?.element).toBe(composer());
    expect(targets.perch?.element).toBe(perch);
    expect(targets.surfaces.map(({ element }) => element)).toEqual(
      expect.arrayContaining([starter, control, row]),
    );
    expect(targets.surfaces.map(({ element }) => element)).not.toContain(perch);
    expect(
      targets.surfaces.every(({ element }) => !element.contains(input)),
    ).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Unsent draft');
    expect(fixture.innerHTML).toBe(before);
  });

  it('selects nearby surfaces before distant ones regardless of document order', () => {
    const far = addRow(0);
    const near = addButton(starters(), 500, 580, 200, 64);
    const nearest = addButton(starters(), 640, 485, 200, 64);
    expect(surfaces(2)).toEqual([nearest, near]);
    expect(surfaces(2)).not.toContain(far);
  });

  it.each([3, 5])('keeps at most %i nonoverlapping wind surfaces', (limit) => {
    for (let index = 0; index < 8; index++) addRow(index, 20, 80 + index * 75);
    addButton(starters(), 470, 560, 200, 64);
    const selected = getBatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
      limit,
    ).surfaces;
    expect(selected).toHaveLength(limit);
    expect(new Set(selected.map(({ element }) => element)).size).toBe(limit);
  });

  it('does not borrow the same area through a row and its nested button', () => {
    const row = addRow(0);
    const nested = addButton(row, 160, 464);
    const selected = surfaces();
    expect(selected.includes(row) && selected.includes(nested)).toBe(false);
    expect(
      selected.some((element) => element === row || element === nested),
    ).toBe(true);
  });

  it('keeps overlapping cards and ancestors of a reserved perch out of the gust', () => {
    const first = addButton(starters(), 530, 530, 200, 64);
    const second = addButton(starters(), 540, 540, 200, 64);
    const row = addRow(0, 410, 410);
    const perch = addButton(row, 550, 415);
    const targets = getBatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    const selected = targets.surfaces.map(({ element }) => element);
    expect(targets.perch?.element).toBe(perch);
    expect(selected).not.toContain(row);
    expect(selected.includes(first) && selected.includes(second)).toBe(false);
  });

  it.each([
    'hidden',
    'inert',
    'aria-hidden',
    'focus',
    'expanded',
    'editable',
    'disabled',
    'disabled-ancestor',
    'editor-child',
    'open-child',
    'transparent',
    'hidden-ancestor',
    'snapshot',
    'outside',
    'wide',
    'tall',
    'large-area',
    'complex',
  ])('rejects %s surfaces and perches', (reason) => {
    const button = addButton(composer(), 610, 430);
    if (reason === 'hidden') button.hidden = true;
    if (reason === 'inert') button.setAttribute('inert', '');
    if (reason === 'aria-hidden') button.setAttribute('aria-hidden', 'true');
    if (reason === 'focus') button.focus();
    if (reason === 'expanded') button.setAttribute('aria-expanded', 'true');
    if (reason === 'editable') button.setAttribute('contenteditable', 'true');
    if (reason === 'disabled') button.disabled = true;
    if (reason === 'disabled-ancestor')
      composer().setAttribute('aria-disabled', 'true');
    if (reason === 'editor-child') button.innerHTML = '<input value="Draft" />';
    if (reason === 'open-child')
      button.innerHTML = '<span aria-expanded="true">Menu</span>';
    if (reason === 'transparent') button.style.opacity = '0';
    if (reason === 'hidden-ancestor') composer().style.visibility = 'hidden';
    if (reason === 'snapshot')
      composer().setAttribute('data-celebration-snapshot', 'true');
    if (reason === 'outside')
      vi.mocked(button.getBoundingClientRect).mockReturnValue(
        new DOMRect(-1, 430, 90, 32),
      );
    if (reason === 'wide')
      vi.mocked(button.getBoundingClientRect).mockReturnValue(
        new DOMRect(610, 430, 441, 32),
      );
    if (reason === 'tall')
      vi.mocked(button.getBoundingClientRect).mockReturnValue(
        new DOMRect(610, 430, 90, 111),
      );
    if (reason === 'large-area')
      vi.mocked(button.getBoundingClientRect).mockReturnValue(
        new DOMRect(610, 430, 440, 76),
      );
    if (reason === 'complex')
      button.innerHTML = '<span></span>'.repeat(BAT_SURFACE_NODE_LIMIT + 1);
    const targets = getBatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(targets.perch?.element).not.toBe(button);
    expect(targets.surfaces.map(({ element }) => element)).not.toContain(
      button,
    );
  });

  it('only includes visible nearby mobile elements and excludes a closed history', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      360,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      780,
    );
    vi.mocked(composer().getBoundingClientRect).mockReturnValue(
      new DOMRect(20, 250, 320, 160),
    );
    fixture.querySelector('ul')!.hidden = true;
    const row = addRow(0);
    const control = addButton(composer(), 40, 355);
    const starter = addButton(starters(), 70, 480, 220, 60);
    const targets = getBatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
      3,
    );
    expect(targets.perch?.element).toBe(control);
    expect(targets.surfaces.map(({ element }) => element)).toEqual([starter]);
    expect(targets.surfaces.map(({ element }) => element)).not.toContain(row);
  });

  it('uses physical RTL geometry and skips clipped rows on either axis', () => {
    fixture.dir = 'rtl';
    const row = addRow(0, 1010, 460);
    expect(surfaces()).toContain(row);
    const list = fixture.querySelector('ul')!;
    list.style.overflowY = 'hidden';
    place(list, 1000, 470, 270, 100);
    expect(surfaces()).not.toContain(row);
    list.style.overflowY = 'visible';
    list.style.overflowX = 'hidden';
    vi.mocked(list.getBoundingClientRect).mockReturnValue(
      new DOMRect(1050, 450, 220, 100),
    );
    expect(surfaces()).not.toContain(row);
  });

  it('leaves distant controls alone and has no invented perch when none are suitable', () => {
    const distant = addButton(welcome(), 10, 10);
    const targets = getBatTargets(testAnchors({ composer: 'composer' }));
    expect(targets.perch).toBeUndefined();
    expect(targets.surfaces.map(({ element }) => element)).not.toContain(
      distant,
    );
  });

  it('skips an entire scene without a visible composer rather than borrowing arbitrary page elements', () => {
    addRow(0);
    composer().hidden = true;
    expect(
      getBatTargets(
        testAnchors({ composer: 'composer', starterList: 'starters' }),
      ),
    ).toEqual({
      width: 1280,
      height: 900,
      surfaces: [],
    });
    expect(
      getBatTargets(testAnchors({ composer: '', starterList: 'starters' })),
    ).toEqual({
      width: 1280,
      height: 900,
      surfaces: [],
    });
  });

  it('bounds history discovery and caches both geometry and ancestor styles per capture', () => {
    const rows = Array.from({ length: 60 }, (_, index) => addRow(index));
    rows.slice(0, 48).forEach((row) => {
      row.hidden = true;
    });
    const first = addButton(composer(), 360, 420);
    const second = addButton(composer(), 480, 420);
    const computedStyle = vi.spyOn(window, 'getComputedStyle');
    getBatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(rows[48].getBoundingClientRect).not.toHaveBeenCalled();
    expect(composer().getBoundingClientRect).toHaveBeenCalledOnce();
    expect(first.getBoundingClientRect).toHaveBeenCalledOnce();
    expect(second.getBoundingClientRect).toHaveBeenCalledOnce();
    for (const element of [composer(), first, second, welcome(), fixture]) {
      expect(
        computedStyle.mock.calls.filter(([measured]) => measured === element),
      ).toHaveLength(1);
    }
  });
});
