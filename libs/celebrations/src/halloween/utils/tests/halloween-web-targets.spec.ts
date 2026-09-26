import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testAnchors } from '../../../test-utils/environment';
import { getHalloweenWebTargets } from '../halloween-web-targets';

const classes = {
  wrapper: 'composer-fixture',
  modelSelectorButton: 'model-fixture',
  addCluster: 'add-fixture',
};
const anchors = testAnchors({
  composer: classes.wrapper,
  composerModelSelector: classes.modelSelectorButton,
  composerAddCluster: classes.addCluster,
});

const place = (element: Element, rect: DOMRect) =>
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);

const getFixtureElement = (root: HTMLElement, selector: string) => {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
};

describe('Halloween web interface anchors', () => {
  let region: HTMLElement;
  let composer: HTMLElement;
  let history: HTMLElement;

  const addRow = (rect = new DOMRect(20, 100, 240, 32)) => {
    const row = document.createElement('li');
    row.innerHTML = '<a href="/conversations/example">A conversation</a>';
    history.append(row);
    place(row, rect);
    return row;
  };

  const addPumpkin = (rect = new DOMRect(1000, 620, 120, 120)) => {
    const wrapper = document.createElement('div');
    wrapper.dataset.halloweenPumpkinAnchor = 'true';
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Halloween pumpkin');
    wrapper.append(button);
    region.append(wrapper);
    place(button, rect);
    return { wrapper, button };
  };

  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    region = document.createElement('section');
    region.setAttribute('role', 'region');
    region.innerHTML =
      '<h1>Welcome</h1><div class="composer-fixture"><textarea></textarea><button class="model-fixture">Model</button><span class="add-fixture"><button>Add</button></span></div>';
    composer = getFixtureElement(region, '.composer-fixture');
    place(composer, new DOMRect(400, 300, 600, 160));
    place(getFixtureElement(region, 'h1'), new DOMRect(520, 200, 240, 48));
    place(
      getFixtureElement(region, '.model-fixture'),
      new DOMRect(420, 410, 100, 32),
    );
    place(
      getFixtureElement(region, '.add-fixture'),
      new DOMRect(540, 410, 32, 32),
    );
    history = document.createElement('ul');
    history.className = 'celebration-history';
    document.body.append(region, history);
  });

  afterEach(() => {
    region.remove();
    history.remove();
    document.documentElement.removeAttribute('dir');
    vi.restoreAllMocks();
  });

  it('uses the composer perimeter, welcome heading and history without nested duplicates or mutations', () => {
    addRow();
    const input = getFixtureElement(composer, 'textarea');
    input.focus();
    const markup = document.body.innerHTML;

    expect(getHalloweenWebTargets(anchors)).toEqual([
      { left: 400, top: 300, width: 600, height: 160 },
      { left: 520, top: 200, width: 240, height: 48 },
      { left: 20, top: 100, width: 240, height: 32 },
    ]);
    expect(document.body.innerHTML).toBe(markup);
    expect(document.activeElement).toBe(input);
  });

  it.each([
    ['hidden', ''],
    ['inert', ''],
    ['aria-hidden', 'true'],
    ['data-celebration-snapshot', ''],
    ['style', 'display: none'],
    ['style', 'visibility: hidden'],
    ['style', 'opacity: 0'],
  ])('ignores a hidden/decorative ancestor with %s=%s', (attribute, value) => {
    region.setAttribute(attribute, value);
    expect(getHalloweenWebTargets(anchors)).toEqual([]);
  });

  it('finds the visible composer after a hidden duplicate', () => {
    const hidden = composer.cloneNode(true) as HTMLElement;
    hidden.hidden = true;
    region.prepend(hidden);
    expect(getHalloweenWebTargets(anchors)[0]).toEqual({
      left: 400,
      top: 300,
      width: 600,
      height: 160,
    });
  });

  it.each(['left', 'top', 'right', 'bottom', 'empty', 'oversized'] as const)(
    'rejects offscreen, empty and oversized history rectangles: %s',
    (reason) => {
      const rectangles = {
        left: new DOMRect(-1, 100, 240, 32),
        top: new DOMRect(20, -1, 240, 32),
        right: new DOMRect(1100, 100, 240, 32),
        bottom: new DOMRect(20, 790, 240, 32),
        empty: new DOMRect(20, 100, 0, 32),
        oversized: new DOMRect(0, 0, 1280, 800),
      };
      region.hidden = true;
      addRow(rectangles[reason]);
      expect(getHalloweenWebTargets(anchors)).toEqual([]);
    },
  );

  it('rejects clipped rows and measures shared scroll ancestors only once', () => {
    region.hidden = true;
    history.style.overflowY = 'auto';
    const measureHistory = place(history, new DOMRect(0, 100, 280, 100));
    addRow(new DOMRect(20, 90, 240, 32));
    addRow(new DOMRect(20, 130, 240, 32));
    addRow(new DOMRect(20, 180, 240, 32));
    expect(getHalloweenWebTargets(anchors)).toEqual([
      { left: 20, top: 130, width: 240, height: 32 },
    ]);
    expect(measureHistory).toHaveBeenCalledOnce();
  });

  it('clips only on the scroll ancestor axis', () => {
    region.hidden = true;
    history.style.overflowX = 'clip';
    history.style.overflowY = 'visible';
    place(history, new DOMRect(0, 0, 280, 80));
    addRow(new DOMRect(20, 130, 240, 32));
    expect(getHalloweenWebTargets(anchors)).toHaveLength(1);
  });

  it('deduplicates repeated links, nested rows and identical geometry', () => {
    region.hidden = true;
    const row = addRow();
    row.insertAdjacentHTML(
      'beforeend',
      '<a href="/conversations/second">Second link</a>',
    );
    const nested = addRow(new DOMRect(30, 104, 200, 24));
    row.append(nested);
    addRow();
    expect(getHalloweenWebTargets(anchors)).toEqual([
      { left: 20, top: 100, width: 240, height: 32 },
    ]);
    expect(row.getBoundingClientRect).toHaveBeenCalledOnce();
  });

  it('keeps the composer and limits visible targets to twelve', () => {
    const rows = Array.from({ length: 100 }, (_, index) =>
      addRow(new DOMRect(20, 60 + index * 40, 240, 32)),
    );
    const result = getHalloweenWebTargets(anchors);
    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ left: 400, top: 300, width: 600, height: 160 });
    expect(rows[10].getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('bounds layout reads even when a huge history contains no visible rows', () => {
    region.hidden = true;
    const rows = Array.from({ length: 200 }, (_, index) =>
      addRow(new DOMRect(20, 850 + index * 40, 240, 32)),
    );
    expect(getHalloweenWebTargets(anchors)).toEqual([]);
    expect(
      rows.filter(
        (row) => vi.mocked(row.getBoundingClientRect).mock.calls.length,
      ),
    ).toHaveLength(48);
    expect(rows[48].getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('reserves a target on the pumpkin body before filling the history budget', () => {
    const { button } = addPumpkin();
    const onActivate = vi.fn();
    button.addEventListener('click', onActivate);
    button.focus();
    const rows = Array.from({ length: 20 }, (_, index) =>
      addRow(new DOMRect(20, 60 + index * 36, 240, 32)),
    );
    const markup = document.body.innerHTML;
    const result = getHalloweenWebTargets(anchors);
    expect(result).toHaveLength(12);
    expect(result[2].left).toBeCloseTo(1019.2);
    expect(result[2].top).toBeCloseTo(653.6);
    expect(result[2].width).toBeCloseTo(81.6);
    expect(result[2].height).toBeCloseTo(69.6);
    expect(rows[9].getBoundingClientRect).not.toHaveBeenCalled();
    expect(button.getBoundingClientRect).toHaveBeenCalledOnce();
    expect(document.body.innerHTML).toBe(markup);
    expect(document.activeElement).toBe(button);
    button.click();
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('skips a hidden pumpkin and anchors the visible one at its physical RTL position', () => {
    document.documentElement.dir = 'rtl';
    const hidden = addPumpkin();
    hidden.wrapper.hidden = true;
    addPumpkin(new DOMRect(16, 620, 100, 100));
    const pumpkin = getHalloweenWebTargets(anchors)[2];
    expect(pumpkin).toMatchObject({
      left: 32,
      top: 648,
      width: 68,
    });
    expect(pumpkin.height).toBeCloseTo(58);
    expect(hidden.button.getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('ignores an offscreen pumpkin without changing the other targets', () => {
    addPumpkin(new DOMRect(1230, 620, 120, 120));
    expect(getHalloweenWebTargets(anchors)).toHaveLength(2);
  });

  it('uses smaller controls when the composer occupies most of the viewport', () => {
    vi.mocked(composer.getBoundingClientRect).mockReturnValue(
      new DOMRect(0, 0, 1280, 800),
    );
    expect(getHalloweenWebTargets(anchors)).toEqual([
      { left: 420, top: 410, width: 100, height: 32 },
      { left: 540, top: 410, width: 32, height: 32 },
      { left: 520, top: 200, width: 240, height: 48 },
    ]);
  });

  it('keeps measured physical screen coordinates in RTL', () => {
    document.documentElement.dir = 'rtl';
    addRow(new DOMRect(1010, 100, 240, 32));
    expect(getHalloweenWebTargets(anchors)).toContainEqual({
      left: 1010,
      top: 100,
      width: 240,
      height: 32,
    });
  });
});
