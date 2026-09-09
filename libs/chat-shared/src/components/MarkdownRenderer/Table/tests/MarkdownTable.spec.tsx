import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '../../../../utils/copy-to-clipboard';
import { downloadTextFile } from '../../../../utils/file-download';
import { MarkdownTable } from '../MarkdownTable';
import styles from '../MarkdownTable.module.scss';

vi.mock('../../../../utils/copy-to-clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('../../../../utils/file-download', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../utils/file-download')>();
  return { ...actual, downloadTextFile: vi.fn() };
});

let resizeObserverCallback: ResizeObserverCallback;

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
  observe() {
    // No-op in JSDOM.
  }
  unobserve() {
    // No-op in JSDOM.
  }
  disconnect() {
    // No-op in JSDOM.
  }
}

class IntersectionObserverMock {
  observe() {
    // No-op in JSDOM.
  }
  unobserve() {
    // No-op in JSDOM.
  }
  disconnect() {
    // No-op in JSDOM.
  }
}

const tableChildren = (
  <>
    <thead>
      <tr>
        <th>Name</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Alpha</td>
        <td>1</td>
      </tr>
    </tbody>
  </>
);

const renderTable = (
  props?: Partial<Parameters<typeof MarkdownTable>[0]>,
  children = tableChildren,
) =>
  render(
    <MarkdownTable classNames={{}} {...props}>
      {children}
    </MarkdownTable>,
  );

const actionLabels = {
  copyCsvLabel: 'Copy as CSV',
  copyTxtLabel: 'Copy as TXT',
  copyMarkdownLabel: 'Copy as Markdown',
  copiedLabel: 'Copied!',
  downloadCsvLabel: 'Download as CSV',
};

const actionLabelsWithOpenInCanvas = {
  ...actionLabels,
  openInCanvasLabel: 'Open in canvas',
};

const makeScrollable = (hasContentBeyondEnd: boolean) => {
  const table = screen.getByRole('table');
  /*
   * The scroll container has no accessible role/name when content fits (it
   * only gains role="region" once scrollable), so it cannot be reached with
   * a semantic query — DOM traversal from the table is the only option.
   */
  // eslint-disable-next-line testing-library/no-node-access
  const scrollContainer = table.parentElement as HTMLElement;

  Object.defineProperties(scrollContainer, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 400 },
  });
  vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(
    hasContentBeyondEnd
      ? ({ left: 0, right: 400 } as DOMRect)
      : ({ left: 0, right: 200 } as DOMRect),
  );

  act(() => resizeObserverCallback([], {} as ResizeObserver));
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  vi.mocked(copyToClipboard).mockReset();
  vi.mocked(copyToClipboard).mockResolvedValue(true);
  vi.mocked(downloadTextFile).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MarkdownTable', () => {
  it('renders without table actions when action labels are not supplied', () => {
    renderTable();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the table actions when action labels are supplied', () => {
    renderTable({ actionLabels });

    expect(screen.getByRole('button', { name: 'Copy as CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy as TXT' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copy as Markdown' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Download as CSV' }),
    ).toBeTruthy();
  });

  it('shows a tooltip for each table action without changing its accessible name', async () => {
    const user = userEvent.setup({ delay: null });
    renderTable({ actionLabels });

    for (const label of [
      'Copy as CSV',
      'Copy as TXT',
      'Copy as Markdown',
      'Download as CSV',
    ]) {
      const button = screen.getByRole('button', { name: label });
      await user.hover(button);

      expect(await screen.findByText(label)).toBeTruthy();
      expect(screen.getByRole('button', { name: label })).toBeTruthy();

      await user.unhover(button);
      await waitFor(() => expect(screen.queryByText(label)).toBeNull());
    }
  });

  it('hides table actions while streaming', () => {
    renderTable({ actionLabels, isStreaming: true });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('copies the rendered table as CSV, TXT, and Markdown', async () => {
    const user = userEvent.setup({ delay: null });
    renderTable({ actionLabels });

    await user.click(screen.getByRole('button', { name: 'Copy as CSV' }));
    expect(copyToClipboard).toHaveBeenCalledWith('"Name","Value"\n"Alpha","1"');

    await user.click(screen.getByRole('button', { name: 'Copy as TXT' }));
    expect(copyToClipboard).toHaveBeenCalledWith('Name\tValue\nAlpha\t1');

    await user.click(screen.getByRole('button', { name: 'Copy as Markdown' }));
    expect(copyToClipboard).toHaveBeenCalledWith(
      '| Name | Value |\n| :-- | :-- |\n| Alpha | 1 |',
    );
  });

  it('announces successful copying without renaming the button', async () => {
    const user = userEvent.setup({ delay: null });
    renderTable({ actionLabels });

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');

    await user.click(screen.getByRole('button', { name: 'Copy as CSV' }));

    await waitFor(() => expect(status.textContent).toBe('Copied!'));
    expect(screen.getByRole('button', { name: 'Copy as CSV' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copied!' })).toBeNull();
  });

  it('does not announce copying when the clipboard utility reports failure', async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(copyToClipboard).mockResolvedValue(false);
    renderTable({ actionLabels });

    await user.click(screen.getByRole('button', { name: 'Copy as CSV' }));

    expect(copyToClipboard).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('downloads CSV with a byte-order mark and the default filename', async () => {
    const user = userEvent.setup({ delay: null });
    renderTable({ actionLabels });

    await user.click(screen.getByRole('button', { name: 'Download as CSV' }));

    expect(downloadTextFile).toHaveBeenCalledWith(
      '\uFEFF"Name","Value"\n"Alpha","1"',
      'table.csv',
      'text/csv;charset=utf-8',
    );
  });

  it('uses a host-supplied download filename', async () => {
    const user = userEvent.setup({ delay: null });
    renderTable({ actionLabels, downloadFilename: 'report.csv' });

    await user.click(screen.getByRole('button', { name: 'Download as CSV' }));

    expect(downloadTextFile).toHaveBeenCalledWith(
      '\uFEFF"Name","Value"\n"Alpha","1"',
      'report.csv',
      'text/csv;charset=utf-8',
    );
  });

  it('does not render Open in Canvas when openInCanvasLabel is missing', () => {
    renderTable({ actionLabels, onOpenInCanvas: vi.fn() });

    expect(screen.queryByRole('button', { name: 'Open in canvas' })).toBeNull();
  });

  it('does not render Open in Canvas when onOpenInCanvas is missing', () => {
    renderTable({ actionLabels: actionLabelsWithOpenInCanvas });

    expect(screen.queryByRole('button', { name: 'Open in canvas' })).toBeNull();
  });

  it('renders Open in Canvas when both openInCanvasLabel and onOpenInCanvas are supplied', () => {
    renderTable({
      actionLabels: actionLabelsWithOpenInCanvas,
      onOpenInCanvas: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Open in canvas' })).toBeTruthy();
  });

  it('calls onOpenInCanvas with the table serialized as Markdown', async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenInCanvas = vi.fn();
    renderTable({
      actionLabels: actionLabelsWithOpenInCanvas,
      onOpenInCanvas,
    });

    await user.click(screen.getByRole('button', { name: 'Open in canvas' }));

    expect(onOpenInCanvas).toHaveBeenCalledWith(
      '| Name | Value |\n| :-- | :-- |\n| Alpha | 1 |',
    );
  });

  it('shows a tooltip for Open in Canvas without changing its accessible name', async () => {
    const user = userEvent.setup({ delay: null });
    renderTable({
      actionLabels: actionLabelsWithOpenInCanvas,
      onOpenInCanvas: vi.fn(),
    });

    const button = screen.getByRole('button', { name: 'Open in canvas' });
    await user.hover(button);

    expect(await screen.findByText('Open in canvas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in canvas' })).toBeTruthy();
  });

  it('hides Open in Canvas along with the rest of the header while streaming', () => {
    renderTable({
      actionLabels: actionLabelsWithOpenInCanvas,
      onOpenInCanvas: vi.fn(),
      isStreaming: true,
    });

    expect(screen.queryByRole('button', { name: 'Open in canvas' })).toBeNull();
  });

  it('renders without a scroll region role when content fits', () => {
    renderTable();
    makeScrollable(false);

    const table = screen.getByRole('table');
    // eslint-disable-next-line testing-library/no-node-access -- see makeScrollable above: no accessible role/name exists when content fits
    const scrollContainer = table.parentElement as HTMLElement;

    expect(scrollContainer.getAttribute('role')).toBeNull();
    expect(scrollContainer.getAttribute('tabindex')).toBeNull();
  });

  it('marks the container as a labelled, keyboard-reachable scroll region when content overflows', () => {
    renderTable({ scrollRegionAriaLabel: 'Scrollable table' });
    makeScrollable(true);

    const region = screen.getByRole('region', { name: 'Scrollable table' });
    expect(region.getAttribute('tabindex')).toBe('0');
  });

  it('uses logical RTL layout without mirroring direction-neutral action icons', () => {
    render(
      <div dir="rtl">
        <MarkdownTable classNames={{}} actionLabels={actionLabels}>
          {tableChildren}
        </MarkdownTable>
      </div>,
    );

    makeScrollable(true);

    const region = screen.getByRole('region', { name: 'Scrollable table' });
    expect(region.className).toContain(styles.tableScrollFadeEnd);

    const actionsWrapper = screen.getByRole('button', {
      name: 'Copy as CSV',
    }).parentElement; // eslint-disable-line testing-library/no-node-access -- the actions wrapper has no semantic role; layout classes must be asserted directly
    expect(actionsWrapper?.className).toContain('ms-auto');
    expect(actionsWrapper?.className).not.toContain('left-');
    expect(actionsWrapper?.className).not.toContain('right-');

    [
      'Copy as CSV',
      'Copy as TXT',
      'Copy as Markdown',
      'Download as CSV',
    ].forEach((name) => {
      // eslint-disable-next-line testing-library/no-node-access -- the decorative icon is hidden from assistive technology, so only its class can be asserted
      const icon = screen.getByRole('button', { name }).querySelector('svg');
      expect(icon?.getAttribute('class')).not.toContain('rtl:scale-x-[-1]');
    });
  });
});
