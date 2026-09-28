import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testAnchors } from '../../../test-utils/environment';
import { CAT_BUTTON_NODE_LIMIT, getCatTargets } from '../halloween-cat-targets';

let fixture: HTMLElement;
const place = (
  element: Element,
  left: number,
  top: number,
  width = 90,
  height = 32,
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
const buttons = () =>
  getCatTargets(
    testAnchors({ composer: 'composer', starterList: 'starters' }),
  ).buttons.map(({ element }) => element);

beforeEach(() => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    1280,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    900,
  );
  fixture = document.createElement('div');
  fixture.innerHTML =
    '<aside><button>History action</button></aside><section role="region"><div class="composer"><textarea></textarea></div><div class="starters"></div><div data-halloween-pumpkin-anchor><button>Pumpkin</button></div></section>';
  document.body.appendChild(fixture);
  place(composer(), 350, 300, 600, 180);
});

afterEach(() => {
  fixture.remove();
  vi.restoreAllMocks();
});

describe('cat gravity targets', () => {
  it('keeps the focused composer as a read-only anchor and prefers its compact controls', () => {
    const input = composer().querySelector('textarea')!;
    input.value = 'Unsent draft';
    input.focus();
    input.setSelectionRange(3, 8);
    const first = addButton(composer(), 510, 430);
    const second = addButton(composer(), 615, 430);
    const wide = addButton(composer(), 730, 420, 200, 56);
    const starter = addButton(starters(), 610, 485);
    const before = fixture.outerHTML;
    const targets = getCatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(targets.composer?.element).toBe(composer());
    expect(targets.buttons.map(({ element }) => element)).toEqual(
      expect.arrayContaining([first, second]),
    );
    expect(targets.buttons.map(({ element }) => element)).not.toContain(wide);
    expect(targets.buttons.map(({ element }) => element)).not.toContain(
      starter,
    );
    expect(targets.supports.map(({ element }) => element)).toContain(starter);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Unsent draft');
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
    expect(fixture.outerHTML).toBe(before);
  });

  it('chooses a reachable pair of composer controls over an isolated control', () => {
    const isolated = addButton(composer(), 830, 410);
    const first = addButton(composer(), 365, 420);
    const second = addButton(composer(), 470, 420);
    expect(buttons()).toEqual(expect.arrayContaining([first, second]));
    expect(buttons()).not.toContain(isolated);
  });

  it('falls back to starter buttons below the composer without borrowing cards above it', () => {
    const above = addButton(starters(), 500, 230);
    const first = addButton(starters(), 500, 520);
    const second = addButton(starters(), 620, 520);
    expect(buttons()).toEqual(expect.arrayContaining([first, second]));
    expect(buttons()).not.toContain(above);
    expect(
      getCatTargets(testAnchors({ composer: 'composer' })).buttons,
    ).toEqual([]);
  });

  it('does not make the cat hop to a distant second prize', () => {
    const first = addButton(composer(), 610, 430);
    const farBelow = addButton(starters(), 610, 650);
    const farAcross = addButton(starters(), 1080, 520);
    expect(buttons()).toEqual([first]);
    expect(buttons()).not.toContain(farBelow);
    expect(buttons()).not.toContain(farAcross);
  });

  it('does not select overlapping buttons or a button and its nested control', () => {
    const first = addButton(composer(), 610, 430);
    const overlapping = addButton(composer(), 620, 435);
    const nested = addButton(first, 625, 435, 30, 24);
    const selected = buttons();
    expect(selected).toHaveLength(1);
    expect(
      selected.some((element) =>
        [first, overlapping, nested].includes(element as HTMLButtonElement),
      ),
    ).toBe(true);
  });

  it('keeps at most three real nearby landing supports without copying large starter cards', () => {
    addButton(composer(), 510, 430);
    addButton(composer(), 615, 430);
    const first = addButton(starters(), 380, 520, 320, 110);
    const second = addButton(starters(), 710, 520, 240, 110);
    const third = addButton(starters(), 500, 650, 240, 110);
    const fourth = addButton(starters(), 760, 650, 240, 110);
    const before = fixture.outerHTML;
    const targets = getCatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(targets.supports).toHaveLength(3);
    expect(targets.supports.map(({ element }) => element)).toEqual(
      expect.arrayContaining([first, second, third]),
    );
    expect(targets.supports.map(({ element }) => element)).not.toContain(
      fourth,
    );
    expect(targets.buttons.some(({ element }) => element === first)).toBe(
      false,
    );
    expect(fixture.outerHTML).toBe(before);
  });

  it('keeps selected, overlapping and nested prizes out of the landing supports', () => {
    const first = addButton(starters(), 500, 520);
    const second = addButton(starters(), 620, 520);
    const overlapping = addButton(starters(), 500, 520, 95, 36);
    const nested = addButton(first, 510, 524, 24, 24);
    const support = addButton(starters(), 500, 650, 320, 110);
    const targets = getCatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(targets.buttons).toHaveLength(2);
    expect(targets.supports.map(({ element }) => element)).toEqual([support]);
    expect(targets.supports.map(({ element }) => element)).not.toEqual(
      expect.arrayContaining([first, second, overlapping, nested]),
    );
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
    'display-none',
    'hidden-ancestor',
    'collapsed-ancestor',
    'content-hidden',
    'snapshot',
    'pumpkin',
  ])('does not borrow %s buttons', (reason) => {
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
    if (reason === 'display-none') button.style.display = 'none';
    if (reason === 'hidden-ancestor') composer().style.visibility = 'hidden';
    if (reason === 'collapsed-ancestor')
      composer().style.visibility = 'collapse';
    if (reason === 'content-hidden') button.style.contentVisibility = 'hidden';
    if (reason === 'snapshot')
      button.setAttribute('data-celebration-snapshot', 'true');
    if (reason === 'pumpkin')
      button.setAttribute('data-halloween-pumpkin-anchor', 'true');
    const targets = getCatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(targets.buttons).toEqual([]);
    if (reason === 'focus') expect(targets.composer?.element).toBe(composer());
  });

  it.each([
    ['minimum', 20, 20, true],
    ['maximum width and area', 300, 80, true],
    ['maximum height and area', 250, 96, true],
    ['too narrow', 19, 32, false],
    ['too short', 90, 19, false],
    ['too wide', 301, 32, false],
    ['too tall', 90, 97, false],
    ['too much area', 300, 81, false],
  ])(
    'enforces exact snapshot size bounds: %s',
    (_name, width, height, valid) => {
      const button = addButton(
        starters(),
        450,
        520,
        width as number,
        height as number,
      );
      expect(buttons().includes(button)).toBe(valid);
    },
  );

  it.each([CAT_BUTTON_NODE_LIMIT, CAT_BUTTON_NODE_LIMIT + 1])(
    'allows at most %i descendants in a borrowed control',
    (count) => {
      const button = addButton(composer(), 610, 430);
      button.innerHTML = '<span></span>'.repeat(count);
      expect(buttons().includes(button)).toBe(count === CAT_BUTTON_NODE_LIMIT);
    },
  );

  it.each(['left', 'top', 'right', 'bottom'])(
    'rejects buttons clipped by the viewport at the %s edge',
    (edge) => {
      const button = addButton(composer(), 610, 430);
      const rects: Record<string, DOMRect> = {
        left: new DOMRect(-1, 430, 90, 32),
        top: new DOMRect(610, -1, 90, 32),
        right: new DOMRect(1250, 430, 90, 32),
        bottom: new DOMRect(610, 880, 90, 32),
      };
      vi.mocked(button.getBoundingClientRect).mockReturnValue(rects[edge]);
      expect(buttons()).not.toContain(button);
    },
  );

  it.each(['overflowX', 'overflowY'] as const)(
    'rejects a clipped prize and support along %s',
    (axis) => {
      const button = addButton(starters(), 610, 520);
      starters().style[axis] = 'hidden';
      place(starters(), 620, 530, 80, 22);
      const targets = getCatTargets(
        testAnchors({ composer: 'composer', starterList: 'starters' }),
      );
      expect(targets.buttons).toEqual([]);
      expect(targets.supports.map(({ element }) => element)).not.toContain(
        button,
      );
    },
  );

  it('keeps physical geometry for mobile and RTL layouts', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      360,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      780,
    );
    fixture.dir = 'rtl';
    vi.mocked(composer().getBoundingClientRect).mockReturnValue(
      new DOMRect(20, 250, 320, 160),
    );
    const first = addButton(composer(), 255, 360, 64, 32);
    const second = addButton(composer(), 170, 360, 64, 32);
    const support = addButton(starters(), 20, 470, 320, 110);
    const targets = getCatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    expect(targets.width).toBe(360);
    expect(targets.height).toBe(780);
    expect(targets.buttons.map(({ element }) => element)).toEqual(
      expect.arrayContaining([first, second]),
    );
    expect(
      targets.buttons.find(({ element }) => element === first)?.rect.left,
    ).toBe(255);
    expect(targets.supports[0]).toEqual({
      element: support,
      rect: new DOMRect(20, 470, 320, 110),
    });
  });

  it('returns no targets when the composer is missing or hidden', () => {
    addButton(starters(), 610, 520);
    composer().hidden = true;
    const empty = { width: 1280, height: 900, buttons: [], supports: [] };
    expect(
      getCatTargets(
        testAnchors({ composer: 'composer', starterList: 'starters' }),
      ),
    ).toEqual(empty);
    expect(
      getCatTargets(testAnchors({ composer: '', starterList: 'starters' })),
    ).toEqual(empty);
    expect(
      getCatTargets(
        testAnchors({ composer: 'missing', starterList: 'starters' }),
      ),
    ).toEqual(empty);
  });

  it('bounds control and starter discovery without inspecting unrelated application buttons', () => {
    const controls = Array.from({ length: 17 }, () =>
      addButton(composer(), 610, 430),
    );
    controls.slice(0, 16).forEach((button) => {
      button.hidden = true;
    });
    const firstList = Array.from({ length: 17 }, () =>
      addButton(starters(), 610, 520),
    );
    firstList.slice(0, 16).forEach((button) => {
      button.hidden = true;
    });
    const secondList = document.createElement('div');
    secondList.className = 'starters';
    welcome().appendChild(secondList);
    const second = addButton(secondList, 610, 570);
    const thirdList = document.createElement('div');
    thirdList.className = 'starters';
    welcome().appendChild(thirdList);
    const third = addButton(thirdList, 610, 620);
    const unrelated = fixture.querySelector('aside button')!;
    const unrelatedBounds = place(unrelated, 610, 440);
    expect(buttons()).toEqual([second]);
    expect(controls[16].getBoundingClientRect).not.toHaveBeenCalled();
    expect(firstList[16].getBoundingClientRect).not.toHaveBeenCalled();
    expect(third.getBoundingClientRect).not.toHaveBeenCalled();
    expect(unrelatedBounds).not.toHaveBeenCalled();
  });

  it('checks at most four composer instances instead of searching the entire page', () => {
    composer().hidden = true;
    for (let index = 0; index < 3; index++) {
      const hidden = document.createElement('div');
      hidden.className = 'composer';
      hidden.hidden = true;
      welcome().appendChild(hidden);
    }
    const fifth = document.createElement('div');
    fifth.className = 'composer';
    welcome().appendChild(fifth);
    const bounds = place(fifth, 350, 300, 600, 180);
    expect(
      getCatTargets(
        testAnchors({ composer: 'composer', starterList: 'starters' }),
      ).composer,
    ).toBeUndefined();
    expect(bounds).not.toHaveBeenCalled();
  });

  it('rejects excessively deep anchor trees instead of walking ancestors without a limit', () => {
    const anchor = composer();
    for (let index = 0; index < 32; index++) {
      const wrapper = document.createElement('div');
      anchor.before(wrapper);
      wrapper.appendChild(anchor);
    }
    const computedStyle = vi.spyOn(window, 'getComputedStyle');
    expect(
      getCatTargets(
        testAnchors({ composer: 'composer', starterList: 'starters' }),
      ).composer,
    ).toBeUndefined();
    expect(computedStyle).toHaveBeenCalledTimes(32);
  });

  it('caches geometry and shared ancestor styles while considering prizes and supports', () => {
    const first = addButton(composer(), 510, 430);
    const second = addButton(composer(), 615, 430);
    const support = addButton(starters(), 500, 520, 320, 110);
    const computedStyle = vi.spyOn(window, 'getComputedStyle');
    getCatTargets(
      testAnchors({ composer: 'composer', starterList: 'starters' }),
    );
    for (const element of [composer(), first, second, support]) {
      expect(element.getBoundingClientRect).toHaveBeenCalledOnce();
    }
    for (const element of [
      composer(),
      first,
      second,
      support,
      welcome(),
      fixture,
    ]) {
      expect(
        computedStyle.mock.calls.filter(([measured]) => measured === element),
      ).toHaveLength(1);
    }
  });
});
