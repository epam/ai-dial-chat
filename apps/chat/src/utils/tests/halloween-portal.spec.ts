import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CELEBRATION_HISTORY_CLASS,
  getCelebrationHistoryRows,
} from '../celebration-history';
import {
  animatePortalRows,
  buildPortalLayout,
  pickPortalRows,
} from '../halloween-portal';

const bounds = (x: number, y: number, width = 260, height = 32) =>
  new DOMRect(x, y, width, height);
const stops: (() => void)[] = [];
const cancels: ReturnType<typeof vi.fn>[] = [];
let panel: HTMLUListElement;
let host: HTMLDivElement;

const addRow = (title: string, rect = bounds(30, 160)) => {
  const row = document.createElement('li');
  const link = document.createElement('a');
  link.href = `/conversations/${title}`;
  link.id = `chat-${title}`;
  link.textContent = title;
  row.appendChild(link);
  panel.appendChild(row);
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(rect);
  return { row, link };
};

const borrow = () => {
  const stop = animatePortalRows(getCelebrationHistoryRows(), host, {
    x: 500,
    y: 300,
  });
  stops.push(stop);
  return stop;
};

describe('portal history illusion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    panel = document.createElement('ul');
    panel.className = CELEBRATION_HISTORY_CLASS;
    host = document.createElement('div');
    document.body.append(panel, host);
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => {
        const cancel = vi.fn();
        cancels.push(cancel);
        return { cancel };
      }),
    });
  });
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    cancels.length = 0;
    panel.remove();
    host.remove();
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses real visible history rows and skips focused, clipped and closed rows', () => {
    const visible = addRow('Visible');
    const focused = addRow('Focused', bounds(30, 200));
    focused.link.focus();
    addRow('Offscreen', bounds(30, -20));
    const hidden = addRow('Closed', bounds(30, 240));
    hidden.row.setAttribute('inert', '');
    expect(getCelebrationHistoryRows().map(({ element }) => element)).toEqual([
      visible.row,
    ]);
    panel.style.overflow = 'hidden';
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(
      bounds(0, 0, 324, 170),
    );
    expect(getCelebrationHistoryRows()).toHaveLength(0);
  });

  it('borrows inert snapshots without moving or changing original rows and restores on time', () => {
    const first = addRow('First');
    addRow('Second', bounds(30, 196));
    const original = panel.outerHTML;
    borrow();
    expect(host.children).toHaveLength(2);
    expect(host.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect((host.firstElementChild as HTMLElement).inert).toBe(true);
    expect(host.querySelector('[id], [href]')).toBeNull();
    expect(host.textContent).toContain('First');
    expect(first.link.isConnected).toBe(true);
    expect(panel.outerHTML).toBe(original);
    vi.advanceTimersByTime(9000);
    expect(host.children).toHaveLength(0);
    expect(cancels).toHaveLength(4);
    cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
    expect(panel.outerHTML).toBe(original);
  });

  it.each(['scroll', 'pointerdown', 'focusin', 'visibilitychange', 'resize'])(
    'restores immediately on %s',
    (name) => {
      addRow('First');
      borrow();
      (name === 'resize' ? window : document).dispatchEvent(new Event(name));
      expect(host.children).toHaveLength(0);
      cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
    },
  );

  it('cancels on unmount/replacement and repeated cleanup is harmless', () => {
    addRow('First');
    const stop = borrow();
    stop();
    stop();
    vi.advanceTimersByTime(20000);
    expect(host.children).toHaveLength(0);
    cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
  });

  it.each(['remove', 'rename', 'recycle', 'close'])(
    'restores when virtual rows change: %s',
    async (change) => {
      const { row, link } = addRow('First');
      borrow();
      if (change === 'remove') row.remove();
      if (change === 'rename') link.textContent = 'Renamed';
      if (change === 'recycle') link.href = '/conversations/Other';
      if (change === 'close') panel.setAttribute('inert', '');
      await Promise.resolve();
      expect(host.children).toHaveLength(0);
      cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
    },
  );

  it('leaves rows untouched if animation support is missing or fails partway', () => {
    addRow('First');
    vi.mocked(host.animate).mockImplementationOnce(() => {
      throw new Error('unsupported');
    });
    borrow();
    expect(host.children).toHaveLength(0);
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    borrow();
    expect(host.children).toHaveLength(0);
    expect(panel.textContent).toBe('First');
  });

  it('selects at most two adjacent rows, with randomness and no duplicates', () => {
    ['One', 'Two', 'Three', 'Four'].forEach((title, i) =>
      addRow(title, bounds(30, 160 + i * 36)),
    );
    const rows = getCelebrationHistoryRows();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickPortalRows(rows)).toEqual(rows.slice(0, 2));
    vi.mocked(Math.random).mockReturnValue(0.99);
    expect(pickPortalRows(rows)).toEqual(rows.slice(2));
    expect(pickPortalRows(rows.slice(0, 1))).toHaveLength(1);
    expect(pickPortalRows([])).toHaveLength(0);
  });

  it.each([360, 900, 1280, 1920])(
    'keeps the portal on screen at %i pixels in both directions',
    (width) => {
      for (const x of [0, width - 280]) {
        const { row } = addRow('Chat', bounds(x, 180));
        const rows = [{ element: row, rect: row.getBoundingClientRect() }];
        const layout = buildPortalLayout(width, 800, rows, width < 1280);
        expect(layout.center.x - layout.size / 2).toBeGreaterThanOrEqual(0);
        expect(layout.center.x + layout.size / 2).toBeLessThanOrEqual(width);
        expect(layout.center.y - layout.size).toBeGreaterThanOrEqual(0);
        expect(layout.center.y + layout.size).toBeLessThanOrEqual(800);
      }
    },
  );
});
