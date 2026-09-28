import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGhostTargets,
  GHOST_HOME_NODE_LIMIT,
} from '../halloween-ghost-targets';

let fixture: HTMLElement;
const place = (
  element: Element,
  left: number,
  top: number,
  width = 180,
  height = 40,
) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(left, top, width, height));
const addRow = (index = 0) => {
  const row = document.createElement('li');
  row.innerHTML = `<a href="/conversations/${index}">Conversation ${index}</a>`;
  fixture.querySelector('ul')?.appendChild(row);
  place(row, 20, 80 + index * 100, 240, 40);
  return row;
};
const addButton = (
  container: Element,
  label: string,
  left: number,
  top: number,
) => {
  const button = document.createElement('button');
  button.textContent = label;
  container.appendChild(button);
  place(button, left, top, 90, 32);
  return button;
};
const composer = () => fixture.querySelector<HTMLElement>('.composer')!;
const welcome = () => fixture.querySelector<HTMLElement>('[role="region"]')!;

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
  place(composer(), 350, 350, 650, 170);
  place(welcome().querySelector('h1')!, 520, 150, 300, 50);
  place(
    welcome().querySelector('[data-halloween-pumpkin-anchor]')!,
    1100,
    680,
    120,
    120,
  );
  place(
    welcome().querySelector('[data-halloween-pumpkin-anchor] button')!,
    1100,
    680,
    120,
    120,
  );
});

afterEach(() => {
  fixture.remove();
  vi.restoreAllMocks();
});

describe('ghost possession targets', () => {
  it('spreads whole homes between history, starter cards, controls and headings', () => {
    const row = addRow();
    const starter = addButton(
      welcome().querySelector('.starters')!,
      'Starter',
      650,
      650,
    );
    const control = addButton(composer(), 'Attach', 360, 450);
    const targets = getGhostTargets('composer', 'starters');
    expect(targets.homes.map(({ element }) => element)).toEqual(
      expect.arrayContaining([
        row,
        starter,
        control,
        welcome().querySelector('h1'),
      ]),
    );
    expect(targets.homes).not.toContainEqual(
      expect.objectContaining({ element: composer() }),
    );
    expect(
      targets.homes.find(({ element }) => element === row)?.rect.width,
    ).toBe(240);
    expect(targets.pumpkin?.element).toBe(
      welcome().querySelector('[data-halloween-pumpkin-anchor]'),
    );
    for (const [index, home] of targets.homes.entries()) {
      for (const other of targets.homes.slice(index + 1)) {
        expect(
          Math.hypot(
            home.rect.left +
              home.rect.width / 2 -
              other.rect.left -
              other.rect.width / 2,
            home.rect.top +
              home.rect.height / 2 -
              other.rect.top -
              other.rect.height / 2,
          ),
        ).toBeGreaterThanOrEqual(96);
      }
    }
  });

  it.each([3, 5])('caps a crowded page at %i distinct homes', (limit) => {
    for (let index = 0; index < 7; index++) addRow(index);
    addButton(welcome().querySelector('.starters')!, 'Starter', 650, 650);
    addButton(composer(), 'Attach', 360, 450);
    const homes = getGhostTargets('composer', 'starters', limit).homes;
    expect(homes).toHaveLength(limit);
    expect(new Set(homes.map(({ element }) => element)).size).toBe(limit);
  });

  it('uses visible welcome controls when mobile history is closed', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      360,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      780,
    );
    const row = addRow();
    fixture.querySelector('ul')!.hidden = true;
    vi.mocked(composer().getBoundingClientRect).mockReturnValue(
      new DOMRect(20, 250, 320, 160),
    );
    const heading = welcome().querySelector('h1')!;
    vi.mocked(heading.getBoundingClientRect).mockReturnValue(
      new DOMRect(30, 130, 300, 50),
    );
    const starter = addButton(
      welcome().querySelector('.starters')!,
      'Starter',
      80,
      500,
    );
    const control = addButton(composer(), 'Attach', 40, 360);
    const homes = getGhostTargets('composer', 'starters', 3).homes;
    expect(homes.map(({ element }) => element)).toEqual(
      expect.arrayContaining([starter, control, heading]),
    );
    expect(homes.map(({ element }) => element)).not.toContain(row);
    expect(homes).toHaveLength(3);
    expect(homes.every(({ rect }) => rect.right <= 360)).toBe(true);
  });

  it('does not clone drafts or disturb focus and allows the focused pumpkin reaction anchor', () => {
    const input = composer().querySelector('textarea')!;
    input.value = 'Unsent draft';
    input.focus();
    addButton(composer(), 'Attach', 360, 450);
    const before = fixture.innerHTML;
    const targets = getGhostTargets('composer');
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Unsent draft');
    expect(fixture.innerHTML).toBe(before);
    expect(targets.homes.every(({ element }) => !element.contains(input))).toBe(
      true,
    );
    const pumpkin = welcome().querySelector<HTMLButtonElement>(
      '[data-halloween-pumpkin-anchor] button',
    )!;
    pumpkin.focus();
    const focused = getGhostTargets('composer');
    expect(focused.pumpkin).toBeDefined();
    expect(
      focused.homes.every(({ element }) => !element.contains(pumpkin)),
    ).toBe(true);
    expect(document.activeElement).toBe(pumpkin);
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
    'outside',
    'wide',
    'tall',
    'complex',
  ])('rejects a %s control', (reason) => {
    const control = addButton(composer(), 'Unsafe', 360, 450);
    if (reason === 'hidden') control.hidden = true;
    if (reason === 'inert') control.setAttribute('inert', '');
    if (reason === 'aria-hidden') control.setAttribute('aria-hidden', 'true');
    if (reason === 'focus') control.focus();
    if (reason === 'expanded') control.setAttribute('aria-expanded', 'true');
    if (reason === 'editable') control.setAttribute('contenteditable', 'true');
    if (reason === 'disabled') control.disabled = true;
    if (reason === 'disabled-ancestor')
      composer().setAttribute('aria-disabled', 'true');
    if (reason === 'editor-child')
      control.innerHTML = '<input value="Draft" />';
    if (reason === 'open-child')
      control.innerHTML = '<span aria-expanded="true">Open</span>';
    if (reason === 'transparent') control.style.opacity = '0';
    if (reason === 'hidden-ancestor') composer().style.visibility = 'hidden';
    if (reason === 'outside')
      vi.mocked(control.getBoundingClientRect).mockReturnValue(
        new DOMRect(-1, 450, 90, 32),
      );
    if (reason === 'wide')
      vi.mocked(control.getBoundingClientRect).mockReturnValue(
        new DOMRect(360, 450, 441, 32),
      );
    if (reason === 'tall')
      vi.mocked(control.getBoundingClientRect).mockReturnValue(
        new DOMRect(360, 450, 90, 97),
      );
    if (reason === 'complex')
      control.innerHTML = '<span></span>'.repeat(GHOST_HOME_NODE_LIMIT + 1);
    expect(
      getGhostTargets('composer').homes.map(({ element }) => element),
    ).not.toContain(control);
  });

  it('rejects a clipped history row and keeps physically visible RTL targets', () => {
    const row = addRow();
    fixture.dir = 'rtl';
    vi.mocked(row.getBoundingClientRect).mockReturnValue(
      new DOMRect(1010, 80, 240, 40),
    );
    expect(
      getGhostTargets('composer').homes.map(({ element }) => element),
    ).toContain(row);
    const list = fixture.querySelector('ul')!;
    list.style.overflow = 'hidden';
    place(list, 1010, 80, 100, 40);
    expect(
      getGhostTargets('composer').homes.map(({ element }) => element),
    ).not.toContain(row);
  });

  it('never selects overlapping, neighboring or ancestor-related homes together', () => {
    const row = addRow();
    const nested = addButton(row, 'Menu', 210, 82);
    const neighbor = addButton(
      fixture.querySelector('ul')!,
      'Neighbor',
      100,
      130,
    );
    const homes = getGhostTargets('composer').homes;
    expect(homes.map(({ element }) => element)).toContain(row);
    expect(homes.map(({ element }) => element)).not.toContain(nested);
    expect(homes.map(({ element }) => element)).not.toContain(neighbor);
  });

  it('uses fewer homes when the layout is sparse and has no phantom pumpkin', () => {
    fixture.replaceChildren();
    expect(getGhostTargets('', undefined, 3)).toEqual({
      width: 1280,
      height: 900,
      pumpkin: undefined,
      homes: [],
    });
  });

  it('bounds history discovery and measures each visited element only once', () => {
    const rows = Array.from({ length: 60 }, (_, index) => addRow(index));
    rows.slice(0, 48).forEach((row) => {
      row.hidden = true;
    });
    vi.mocked(rows[48].getBoundingClientRect).mockReturnValue(
      new DOMRect(20, 80, 240, 40),
    );
    expect(
      getGhostTargets('composer').homes.map(({ element }) => element),
    ).not.toContain(rows[48]);
    expect(rows[48].getBoundingClientRect).not.toHaveBeenCalled();
    rows[0].hidden = false;
    getGhostTargets('composer');
    expect(rows[0].getBoundingClientRect).toHaveBeenCalledOnce();
    expect(composer().getBoundingClientRect).toHaveBeenCalledTimes(2);
  });
});
