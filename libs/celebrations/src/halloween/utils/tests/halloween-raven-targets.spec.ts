import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testAnchors } from '../../../test-utils/environment';
import {
  getRavenTargets,
  RAVEN_ROW_NODE_LIMIT,
  RAVEN_FRAGMENT_NODE_LIMIT,
} from '../halloween-raven-targets';

let fixture: HTMLElement;
const rect = (
  element: Element,
  x: number,
  y: number,
  width = 220,
  height = 40,
) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(x, y, width, height));
const addRow = (index: number) => {
  const row = document.createElement('li');
  row.innerHTML = `<a href="/conversations/${index}">Conversation ${index}</a>`;
  fixture.querySelector('ul')?.appendChild(row);
  rect(row, 24, 80 + index * 45);
  return row;
};
beforeEach(() => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    1280,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    900,
  );
  fixture = document.createElement('section');
  fixture.innerHTML =
    '<div class="composer"><textarea></textarea></div><div data-halloween-pumpkin-anchor><button>Pumpkin</button></div><ul class="celebration-history"></ul>';
  document.body.appendChild(fixture);
  rect(fixture.querySelector('.composer')!, 400, 400, 700, 150);
  rect(
    fixture.querySelector('[data-halloween-pumpkin-anchor]')!,
    1100,
    650,
    128,
    128,
  );
});
afterEach(() => {
  fixture.remove();
  vi.restoreAllMocks();
});

describe('raven UI targets', () => {
  it('finds one visible conversation, composer and pumpkin without touching focus or contents', () => {
    const row = addRow(0);
    const input = fixture.querySelector('textarea')!;
    input.value = 'Unsent message';
    input.focus();
    const before = fixture.innerHTML;
    const targets = getRavenTargets(testAnchors({ composer: 'composer' }));
    expect(targets.conversation?.element).toBe(row);
    expect(targets.pumpkin).not.toBeNull();
    expect(targets.composer).not.toBeNull();
    expect(fixture.innerHTML).toBe(before);
    expect(input.value).toBe('Unsent message');
    expect(document.activeElement).toBe(input);
  });

  it.each([
    'hidden',
    'inert',
    'aria-hidden',
    'focus',
    'expanded',
    'outside',
    'large',
    'complex',
    'transparent',
  ])('does not borrow a %s conversation', (reason) => {
    const row = addRow(0);
    if (reason === 'hidden') row.hidden = true;
    if (reason === 'inert') row.setAttribute('inert', '');
    if (reason === 'aria-hidden') row.setAttribute('aria-hidden', 'true');
    if (reason === 'focus') row.querySelector('a')?.focus();
    if (reason === 'expanded')
      row.querySelector('a')?.setAttribute('aria-expanded', 'true');
    if (reason === 'outside')
      vi.mocked(row.getBoundingClientRect).mockReturnValue(
        new DOMRect(-5, 40, 220, 40),
      );
    if (reason === 'large')
      vi.mocked(row.getBoundingClientRect).mockReturnValue(
        new DOMRect(20, 40, 600, 40),
      );
    if (reason === 'complex')
      row.innerHTML += '<span></span>'.repeat(RAVEN_ROW_NODE_LIMIT);
    if (reason === 'transparent') row.style.opacity = '0';
    expect(
      getRavenTargets(testAnchors({ composer: 'composer' })).conversation,
    ).toBeNull();
  });

  it('rejects a row behind a scroll clip and falls back to the composer', () => {
    addRow(0);
    const list = fixture.querySelector('ul')!;
    list.style.overflow = 'hidden';
    rect(list, 24, 80, 100, 30);
    const targets = getRavenTargets(testAnchors({ composer: 'composer' }));
    expect(targets.conversation).toBeNull();
    expect(targets.edges.map(({ element }) => element)).toEqual([
      fixture.querySelector('.composer'),
    ]);
  });

  it('ignores hidden ancestors and can read physical RTL placement', () => {
    const row = addRow(0);
    fixture.dir = 'rtl';
    vi.mocked(row.getBoundingClientRect).mockReturnValue(
      new DOMRect(1010, 80, 220, 40),
    );
    expect(
      getRavenTargets(testAnchors({ composer: 'composer' })).conversation?.rect
        .left,
    ).toBe(1010);
    fixture.style.visibility = 'hidden';
    expect(
      getRavenTargets(testAnchors({ composer: 'composer' })),
    ).toMatchObject({
      conversation: null,
      pumpkin: null,
      composer: null,
      fragments: [],
      edges: [],
    });
  });

  it('chooses separated pieces across headings, composer controls and history', () => {
    fixture.setAttribute('role', 'region');
    const heading = document.createElement('h1');
    heading.textContent = 'How can I help?';
    fixture.prepend(heading);
    rect(heading, 480, 100, 400, 40);
    const composer = fixture.querySelector('.composer')!;
    composer.insertAdjacentHTML(
      'beforeend',
      '<button>Attach</button><button>Send</button>',
    );
    const [attach, send] = composer.querySelectorAll('button');
    rect(attach, 410, 480, 60, 36);
    rect(send, 1030, 480, 60, 36);
    addRow(0);
    addRow(5);
    addRow(10);
    const targets = getRavenTargets(testAnchors({ composer: 'composer' }));
    const elements = targets.fragments.map(({ element }) => element);
    expect(elements).toEqual(expect.arrayContaining([heading, attach, send]));
    expect(elements).not.toContain(targets.conversation?.element);
    expect(new Set(elements).size).toBe(elements.length);
    for (const [index, fragment] of targets.fragments.entries()) {
      expect(fragment.crop.width).toBeLessThanOrEqual(76);
      expect(fragment.crop.height).toBeLessThanOrEqual(32);
      for (const other of targets.fragments.slice(index + 1)) {
        expect(
          Math.hypot(
            fragment.crop.x +
              fragment.crop.width / 2 -
              other.crop.x -
              other.crop.width / 2,
            fragment.crop.y +
              fragment.crop.height / 2 -
              other.crop.y -
              other.crop.height / 2,
          ),
        ).toBeGreaterThanOrEqual(96);
      }
    }
  });

  it('never copies large controls, editors or the focused fragment', () => {
    fixture.setAttribute('role', 'region');
    const composer = fixture.querySelector('.composer')!;
    composer.insertAdjacentHTML(
      'beforeend',
      '<button>Focused</button><button>Complex</button><h2 contenteditable="true">Draft</h2>',
    );
    const [focused, complex] = composer.querySelectorAll('button');
    rect(focused, 400, 480, 80, 32);
    rect(complex, 950, 480, 80, 32);
    complex.innerHTML = '<span></span>'.repeat(RAVEN_FRAGMENT_NODE_LIMIT + 1);
    focused.focus();
    expect(
      getRavenTargets(testAnchors({ composer: 'composer' })).fragments,
    ).toHaveLength(0);
  });

  it('bounds history discovery and caches rectangle reads during setup', () => {
    const rows = Array.from({ length: 100 }, (_, index) => addRow(index));
    rows.slice(0, 48).forEach((row) => {
      row.hidden = true;
    });
    vi.mocked(rows[48].getBoundingClientRect).mockReturnValue(
      new DOMRect(20, 80, 220, 40),
    );
    expect(
      getRavenTargets(testAnchors({ composer: 'composer' })).conversation,
    ).toBeNull();
    expect(rows[48].getBoundingClientRect).not.toHaveBeenCalled();
    rows[0].hidden = false;
    expect(
      getRavenTargets(testAnchors({ composer: 'composer' })).conversation
        ?.element,
    ).toBe(rows[0]);
    expect(rows[0].getBoundingClientRect).toHaveBeenCalledOnce();
  });
});
