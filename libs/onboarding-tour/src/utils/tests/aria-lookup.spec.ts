import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessibleName,
  findControl,
  findControlBy,
  findControlNear,
  findSearch,
  firstNamed,
  firstOnScreen,
  isOnScreen,
  lastOnScreen,
  named,
  queryAll,
} from '../aria-lookup';

/* jsdom lays nothing out, so every element reports no box; elements marked
 * `data-hidden` keep that, the rest report one rect. */
const HIDDEN_ATTRIBUTE = 'data-hidden';

const getElement = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`No element matches ${selector}`);
  }
  return element;
};

const render = (html: string): void => {
  document.body.innerHTML = html;
};

describe('aria-lookup', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
      function (this: HTMLElement) {
        return (this.hasAttribute(HIDDEN_ATTRIBUTE)
          ? []
          : [new DOMRect(0, 0, 1, 1)]) as unknown as DOMRectList;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('isOnScreen', () => {
    it('accepts an element with a box', () => {
      render('<button>Go</button>');
      expect(isOnScreen(getElement('button'))).toBe(true);
    });

    it('rejects an element without a box', () => {
      render(`<button ${HIDDEN_ATTRIBUTE}>Go</button>`);
      expect(isOnScreen(getElement('button'))).toBe(false);
    });

    it('rejects an element inside an inert subtree', () => {
      render('<div inert><button>Go</button></div>');
      expect(isOnScreen(getElement('button'))).toBe(false);
    });

    it('rejects an element with visibility hidden', () => {
      render('<button style="visibility: hidden">Go</button>');
      expect(isOnScreen(getElement('button'))).toBe(false);
    });
  });

  describe('firstOnScreen / lastOnScreen', () => {
    it('skips off-screen elements from either end', () => {
      render(
        `<i ${HIDDEN_ATTRIBUTE}></i><b id="first"></b><b id="last"></b><i ${HIDDEN_ATTRIBUTE}></i>`,
      );
      const elements = Array.from(document.body.children);
      expect(firstOnScreen(elements)?.id).toBe('first');
      expect(lastOnScreen(elements)?.id).toBe('last');
    });

    it('returns null when nothing is on screen', () => {
      render(`<i ${HIDDEN_ATTRIBUTE}></i>`);
      expect(firstOnScreen(Array.from(document.body.children))).toBeNull();
    });
  });

  describe('accessibleName', () => {
    it('prefers aria-labelledby, then aria-label, then the label, then text', () => {
      render(`
        <span id="a">Alpha</span><span id="b">Beta</span>
        <button id="labelled" aria-labelledby="a b" aria-label="Ignored">x</button>
        <button id="aria" aria-label=" Close ">x</button>
        <label for="field">Query</label><input id="field" />
        <button id="text"> Send </button>
      `);
      const byId = (id: string) => getElement(`#${id}`);
      expect(accessibleName(byId('labelled'))).toBe('Alpha Beta');
      expect(accessibleName(byId('aria'))).toBe('Close');
      expect(accessibleName(byId('field'))).toBe('Query');
      expect(accessibleName(byId('text'))).toBe('Send');
    });
  });

  describe('queryAll / named / firstNamed', () => {
    it('collects matches across scopes in order', () => {
      render(
        '<section id="one"><a href="#">A</a></section><section id="two"><a href="#">B</a></section>',
      );
      const scopes = [getElement('#two'), getElement('#one')];
      expect(queryAll(scopes, 'a').map((a: Element) => a.textContent)).toEqual([
        'B',
        'A',
      ]);
    });

    it('filters by accessible name and picks the first on screen', () => {
      render(
        `<button id="hidden" ${HIDDEN_ATTRIBUTE}>Save</button><button id="shown">Save</button><button>Other</button>`,
      );
      expect(named([document], 'button', 'Save')).toHaveLength(2);
      expect(firstNamed([document], 'button', 'Save')?.id).toBe('shown');
    });
  });

  describe('findControl / findControlBy', () => {
    it('finds buttons, links and role=button by name', () => {
      render(
        '<a href="/x">Docs</a><div role="button">Menu</div><span>Docs</span>',
      );
      expect(findControl([document], 'Docs')?.tagName).toBe('A');
      expect(findControl([document], 'Menu')?.getAttribute('role')).toBe(
        'button',
      );
      expect(
        findControlBy([document], (name: string) => name.startsWith('Me'))
          ?.textContent,
      ).toBe('Menu');
    });

    it('ignores an anchor without href', () => {
      render('<a>Docs</a>');
      expect(findControl([document], 'Docs')).toBeNull();
    });
  });

  describe('findControlNear', () => {
    it('returns the control in the smallest ancestor that holds one', () => {
      render(`
        <div><button id="far">More</button>
          <div><button id="near">More</button><span id="start"></span></div>
        </div>
      `);
      expect(
        findControlNear(
          document.getElementById('start'),
          (name: string) => name === 'More',
        )?.id,
      ).toBe('near');
    });

    it('returns null without a start element', () => {
      expect(findControlNear(null, () => true)).toBeNull();
    });
  });

  describe('findSearch', () => {
    it('returns the role=search wrapper of the named input', () => {
      render(
        '<div role="search" id="wrap"><input aria-label="Search" /></div>',
      );
      expect(findSearch([document], 'Search')?.id).toBe('wrap');
    });

    it('returns the input itself without a wrapper', () => {
      render('<input aria-label="Search" id="bare" />');
      expect(findSearch([document], 'Search')?.id).toBe('bare');
    });

    it('returns null when no input has the name', () => {
      render('<input aria-label="Filter" />');
      expect(findSearch([document], 'Search')).toBeNull();
    });
  });
});
