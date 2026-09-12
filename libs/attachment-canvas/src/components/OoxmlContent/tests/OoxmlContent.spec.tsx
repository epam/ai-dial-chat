import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OoxmlHighlight } from '../../../models/attachment-canvas';
import {
  AttachmentContentType,
  OoxmlFileType,
  OoxmlHighlightKind,
} from '../../../types/attachment-canvas';
import { OoxmlContent } from '../OoxmlContent';

const {
  mockDocxConstructor,
  mockXlsxConstructor,
  mockXlsxSheetConstructor,
  mockPptxConstructor,
  mockLoad,
  mockDestroy,
  mockChartEx,
  mockDocumentLoad,
  mockCollectPageRuns,
  mockFromDocument,
  mockScrollToPage,
  mockPresentationLoad,
  mockCollectSlideRuns,
  mockFromPresentation,
  mockScrollToSlide,
  mockGetCellViewportRect,
  mockGoToSheet,
  mockScrollToCell,
  xlsxViewerState,
  teardownOrder,
  importState,
} = vi.hoisted(() => ({
  mockDocxConstructor: vi.fn(),
  mockXlsxConstructor: vi.fn(),
  mockXlsxSheetConstructor: vi.fn(),
  mockPptxConstructor: vi.fn(),
  mockLoad: vi.fn(),
  mockDestroy: vi.fn(),
  mockChartEx: {},
  mockDocumentLoad: vi.fn(),
  mockCollectPageRuns: vi.fn(),
  mockFromDocument: vi.fn(),
  mockScrollToPage: vi.fn(),
  mockPresentationLoad: vi.fn(),
  mockCollectSlideRuns: vi.fn(),
  mockFromPresentation: vi.fn(),
  mockScrollToSlide: vi.fn(),
  mockGetCellViewportRect: vi.fn(),
  mockGoToSheet: vi.fn(),
  mockScrollToCell: vi.fn(),
  /* Mutable so a test can move the "active sheet" before rendering. */
  xlsxViewerState: { sheetNames: ['Sheet1'], sheetIndex: 0 },
  /* Records `destroy()` calls in order so the viewer-then-engine contract of a
   * borrowed engine can be asserted, not just the call counts. */
  teardownOrder: [] as string[],
  /* Lets one test simulate a failed chunk load: reading the export throws
   * while the module specifier itself still resolves. */
  importState: { shouldFailDocx: false },
}));

vi.mock('@silurus/ooxml/chart-ex', () => ({ chartEx: mockChartEx }));

vi.mock('@silurus/ooxml/docx', () => {
  const DocxScrollViewer = function (...args: unknown[]) {
    mockDocxConstructor(...args);
    return { load: mockLoad, destroy: mockDestroy };
  } as unknown as {
    new (...args: unknown[]): unknown;
    fromDocument: (container: HTMLElement, ...rest: unknown[]) => unknown;
  };

  /* Mirrors the real viewer's DOM: a relative wrapper holding a scrolling host
   * marked with an inline `overflow:auto`, which is how the overlay finds it. */
  DocxScrollViewer.fromDocument = (container, ...rest) => {
    mockFromDocument(container, ...rest);
    const wrapper = document.createElement('div');
    const scrollHost = document.createElement('div');
    scrollHost.style.overflow = 'auto';
    wrapper.appendChild(scrollHost);
    container.appendChild(wrapper);
    return {
      getScale: () => 1,
      scrollToPage: mockScrollToPage,
      destroy: () => {
        teardownOrder.push('viewer');
        mockDestroy();
      },
    };
  };

  return {
    get DocxScrollViewer() {
      if (importState.shouldFailDocx) {
        throw new Error('Failed to fetch dynamically imported module');
      }
      return DocxScrollViewer;
    },
    DocxDocument: {
      load: async (...args: unknown[]) => {
        mockDocumentLoad(...args);
        return {
          pageCount: 1,
          pageSize: () => ({ widthPt: 612, heightPt: 792 }),
          collectPageRuns: mockCollectPageRuns,
          destroy: () => {
            teardownOrder.push('engine');
          },
        };
      },
    },
  };
});

vi.mock('@silurus/ooxml/xlsx', () => ({
  XlsxViewer: function (...args: unknown[]) {
    mockXlsxConstructor(...args);
    return {
      load: mockLoad,
      destroy: mockDestroy,
      get sheetNames() {
        return xlsxViewerState.sheetNames;
      },
      get sheetIndex() {
        return xlsxViewerState.sheetIndex;
      },
      getCellViewportRect: mockGetCellViewportRect,
      goToSheet: mockGoToSheet,
      scrollToCell: mockScrollToCell,
    };
  },
  XlsxSheetViewer: function (...args: unknown[]) {
    mockXlsxSheetConstructor(...args);
    return { load: mockLoad, destroy: mockDestroy };
  },
}));

vi.mock('@silurus/ooxml/pptx', () => {
  const PptxScrollViewer = function (...args: unknown[]) {
    mockPptxConstructor(...args);
    return { load: mockLoad, destroy: mockDestroy };
  } as unknown as {
    new (...args: unknown[]): unknown;
    fromPresentation: (container: HTMLElement, ...rest: unknown[]) => unknown;
  };

  /* Mirrors the real viewer's DOM: a relative wrapper holding a scrolling host
   * marked with an inline `overflow:auto`, which is how the overlay finds it. */
  PptxScrollViewer.fromPresentation = (container, ...rest) => {
    mockFromPresentation(container, ...rest);
    const wrapper = document.createElement('div');
    const scrollHost = document.createElement('div');
    scrollHost.style.overflow = 'auto';
    wrapper.appendChild(scrollHost);
    container.appendChild(wrapper);
    return {
      getScale: () => 1,
      scrollToSlide: mockScrollToSlide,
      destroy: () => {
        teardownOrder.push('viewer');
        mockDestroy();
      },
    };
  };

  return {
    PptxScrollViewer,
    PptxPresentation: {
      load: async (...args: unknown[]) => {
        mockPresentationLoad(...args);
        return {
          slideCount: 10,
          slideWidth: 9144000,
          slideHeight: 6858000,
          collectSlideRuns: mockCollectSlideRuns,
          destroy: () => {
            teardownOrder.push('engine');
          },
        };
      },
    },
  };
});

const makeContent = (format: OoxmlFileType, url = `blob:${format}`) => ({
  type: AttachmentContentType.Ooxml as const,
  url,
  format,
});

const renderContent = (format: OoxmlFileType) =>
  render(
    <OoxmlContent
      content={makeContent(format)}
      fileName={`report.${format}`}
      loadErrorLabel="Failed to load file"
      formulaLabel="Formula"
      formulaLabelClassName="dial-italic-text"
    />,
  );

describe('OoxmlContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(undefined);
    mockCollectPageRuns.mockResolvedValue([]);
    mockCollectSlideRuns.mockResolvedValue([]);
    mockGetCellViewportRect.mockReturnValue(null);
    mockGoToSheet.mockResolvedValue(undefined);
    mockScrollToCell.mockResolvedValue(undefined);
    xlsxViewerState.sheetNames = ['Sheet1'];
    xlsxViewerState.sheetIndex = 0;
    teardownOrder.length = 0;
    importState.shouldFailDocx = false;
  });

  it.each([
    [OoxmlFileType.Docx, mockDocxConstructor],
    [OoxmlFileType.Xlsx, mockXlsxConstructor],
    [OoxmlFileType.Pptx, mockPptxConstructor],
  ])(
    'loads %s with its format-specific viewer',
    async (format, constructor) => {
      renderContent(format);

      await waitFor(() => expect(constructor).toHaveBeenCalledOnce());
      expect(mockLoad).toHaveBeenCalledWith(`blob:${format}`);
      await waitFor(() =>
        expect(screen.getByRole('document').getAttribute('aria-busy')).toBe(
          'false',
        ),
      );
    },
  );

  it('loads CSV through the Excel-style sheet viewer', async () => {
    renderContent(OoxmlFileType.Csv);

    await waitFor(() =>
      expect(mockXlsxSheetConstructor).toHaveBeenCalledOnce(),
    );
    expect(mockXlsxSheetConstructor.mock.calls[0][0]).toBeInstanceOf(
      HTMLCanvasElement,
    );
    expect(mockXlsxSheetConstructor.mock.calls[0][1]).toMatchObject({
      showScrollbars: true,
    });
    expect(mockLoad).toHaveBeenCalledWith('blob:csv', { format: 'csv' });
    await waitFor(() =>
      expect(screen.getByRole('document').getAttribute('aria-busy')).toBe(
        'false',
      ),
    );
  });

  it('does not render the XLSX formula panel for CSV', async () => {
    renderContent(OoxmlFileType.Csv);

    await waitFor(() =>
      expect(mockXlsxSheetConstructor).toHaveBeenCalledOnce(),
    );
    expect(screen.queryByRole('region', { name: 'Formula' })).toBeNull();
  });

  it('keeps an empty formula panel visible before an XLSX cell is selected', async () => {
    renderContent(OoxmlFileType.Xlsx);

    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());
    const panel = screen.getByRole('region', { name: 'Formula' });
    expect(panel.textContent).toBe('fx');
    expect(screen.getByText('fx').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('fx').className).toContain('shrink-0');
    expect(screen.getByText('fx').className).toContain('dial-italic-text');
  });

  it.each([
    [OoxmlFileType.Docx, mockDocxConstructor],
    [OoxmlFileType.Xlsx, mockXlsxConstructor],
    [OoxmlFileType.Pptx, mockPptxConstructor],
  ])('enables ChartEx rendering for %s', async (format, constructor) => {
    renderContent(format);
    await waitFor(() => expect(constructor).toHaveBeenCalledOnce());

    expect(constructor.mock.calls[0][1]).toMatchObject({
      chartEx: mockChartEx,
    });
  });

  it('destroys the viewer on unmount', async () => {
    const view = renderContent(OoxmlFileType.Docx);
    await waitFor(() => expect(mockLoad).toHaveBeenCalledOnce());

    view.unmount();

    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('shows the supplied error message when loading fails', async () => {
    mockLoad.mockRejectedValue(new Error('invalid OOXML'));

    renderContent(OoxmlFileType.Pptx);

    expect(await screen.findByText('Failed to load file')).toBeTruthy();
  });

  it('shows an alert when the viewer reports a rendering error', async () => {
    renderContent(OoxmlFileType.Xlsx);
    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());

    const options = mockXlsxConstructor.mock.calls[0][1] as {
      onError: () => void;
    };
    act(() => options.onError());

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Failed to load file',
    );
  });

  it('marks the container busy and shows a spinner while parsing', () => {
    mockLoad.mockReturnValue(new Promise(() => undefined));

    renderContent(OoxmlFileType.Docx);

    const container = screen.getByRole('document');
    expect(container.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('labels the container with the file name', () => {
    renderContent(OoxmlFileType.Xlsx);

    expect(screen.getByRole('document').getAttribute('aria-label')).toBe(
      'report.xlsx',
    );
  });

  it('shows the active XLSX cell formula in a separate panel', async () => {
    renderContent(OoxmlFileType.Xlsx);
    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());

    const options = mockXlsxConstructor.mock.calls[0][1] as {
      onSelectionContextChange: (context: {
        kind: 'range';
        selection: { activeCell: { row: number; col: number } };
        cells: Array<{
          address: { row: number; col: number };
          displayText: string;
          formula?: string;
        }>;
      }) => void;
    };
    act(() =>
      options.onSelectionContextChange({
        kind: 'range',
        selection: { activeCell: { row: 2, col: 3 } },
        cells: [
          {
            address: { row: 2, col: 3 },
            displayText: '3',
            formula: 'SUM(A1:A2)',
          },
        ],
      }),
    );

    expect(screen.getByRole('region', { name: 'Formula' }).textContent).toBe(
      'fx=SUM(A1:A2)',
    );
  });

  it('shows the active XLSX cell display value when it has no formula', async () => {
    renderContent(OoxmlFileType.Xlsx);
    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());

    const options = mockXlsxConstructor.mock.calls[0][1] as {
      onSelectionContextChange: (context: {
        kind: 'range';
        selection: { activeCell: { row: number; col: number } };
        cells: Array<{
          address: { row: number; col: number };
          displayText: string;
          formula?: string;
        }>;
      }) => void;
    };
    act(() =>
      options.onSelectionContextChange({
        kind: 'range',
        selection: { activeCell: { row: 2, col: 3 } },
        cells: [
          {
            address: { row: 2, col: 3 },
            displayText: '3',
            formula: 'SUM(A1:A2)',
          },
        ],
      }),
    );
    expect(screen.getByRole('region', { name: 'Formula' })).toBeTruthy();

    act(() =>
      options.onSelectionContextChange({
        kind: 'range',
        selection: { activeCell: { row: 2, col: 3 } },
        cells: [
          {
            address: { row: 2, col: 3 },
            displayText: '1,234.50',
          },
        ],
      }),
    );

    expect(screen.getByRole('region', { name: 'Formula' }).textContent).toBe(
      'fx1,234.50',
    );
  });

  it('removes the status overlay after a successful load', async () => {
    renderContent(OoxmlFileType.Docx);

    await waitFor(() =>
      expect(screen.getByRole('document').getAttribute('aria-busy')).toBe(
        'false',
      ),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Failed to load file')).toBeNull();
  });

  it('shows the error panel when the viewer module fails to load', async () => {
    importState.shouldFailDocx = true;

    renderContent(OoxmlFileType.Docx);

    expect(await screen.findByText('Failed to load file')).toBeTruthy();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('destroys the viewer and clears the container when loading rejects', async () => {
    mockLoad.mockRejectedValue(new Error('invalid OOXML'));

    renderContent(OoxmlFileType.Docx);

    await screen.findByText('Failed to load file');
    expect(mockDestroy).toHaveBeenCalled();
    // eslint-disable-next-line testing-library/no-node-access -- the viewer container is intentionally opaque; emptiness is only observable via the DOM
    expect(screen.getByRole('document').childElementCount).toBe(0);
  });

  it('destroys a viewer that resolves after unmount without loading it', async () => {
    /* Unmounting synchronously disposes the effect before the awaited dynamic
     * import resolves — the viewer must still be torn down. */
    const view = renderContent(OoxmlFileType.Docx);
    view.unmount();

    await waitFor(() => expect(mockDestroy).toHaveBeenCalled());
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('rebuilds the viewer when the url changes', async () => {
    const view = render(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Docx, 'blob:first')}
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
      />,
    );
    await waitFor(() => expect(mockLoad).toHaveBeenCalledWith('blob:first'));

    view.rerender(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Docx, 'blob:second')}
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
      />,
    );

    await waitFor(() => expect(mockLoad).toHaveBeenCalledWith('blob:second'));
    expect(mockDestroy).toHaveBeenCalled();
    expect(mockDocxConstructor).toHaveBeenCalledTimes(2);
  });

  it('rebuilds with the new format-specific viewer when the format changes', async () => {
    const view = render(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Docx)}
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
      />,
    );
    await waitFor(() => expect(mockDocxConstructor).toHaveBeenCalledOnce());

    view.rerender(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Xlsx)}
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
      />,
    );

    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('does not rebuild when a new content object carries the same url and format', async () => {
    const view = render(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Docx)}
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
      />,
    );
    await waitFor(() => expect(mockDocxConstructor).toHaveBeenCalledOnce());

    view.rerender(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Docx)}
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
      />,
    );

    expect(mockDocxConstructor).toHaveBeenCalledOnce();
    expect(mockDestroy).not.toHaveBeenCalled();
  });
});

describe('OoxmlContent highlights', () => {
  const highlight = (id: string, path: number[]): OoxmlHighlight => ({
    id,
    locations: [
      {
        kind: OoxmlHighlightKind.DocxTextRange,
        story: 'body',
        path,
        start: 0,
        endExclusive: 5,
        text: 'Hello',
      },
    ],
  });

  const run = (path: number[]) => ({
    source: { story: 'body', storyInstance: 'main', path },
    sourceRunIndex: 0,
    text: 'Hello',
    x: 0,
    y: 100,
    w: 50,
    h: 12,
    fontSize: 12,
    font: '12px Arial',
  });

  const renderHighlighted = (
    highlights: OoxmlHighlight[] | undefined,
    selectedHighlightId?: string,
  ) =>
    render(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights,
          selectedHighlightId,
        }}
        fileName="report.docx"
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
        highlightsLabel="Cited locations"
        highlightNavigatedLabel="Scrolled to the cited location"
      />,
    );

  const getRects = (): Element[] => [
    // eslint-disable-next-line testing-library/no-node-access -- the rects are decorative and carry no role of their own; counting them has no semantic query
    ...screen.getByRole('region', { name: 'Cited locations' }).children,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(undefined);
    mockCollectPageRuns.mockResolvedValue([run([3, 1])]);
    mockCollectSlideRuns.mockResolvedValue([]);
    mockGetCellViewportRect.mockReturnValue(null);
    mockGoToSheet.mockResolvedValue(undefined);
    mockScrollToCell.mockResolvedValue(undefined);
    xlsxViewerState.sheetNames = ['Sheet1'];
    xlsxViewerState.sheetIndex = 0;
    teardownOrder.length = 0;
    importState.shouldFailDocx = false;
  });

  it('loads the engine once and creates the viewer from that instance', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());
    expect(mockDocumentLoad).toHaveBeenCalledOnce();
    expect(mockDocumentLoad.mock.calls[0][0]).toBe('blob:docx');
    /* The self-loading constructor must not also run: that would be a second parse. */
    expect(mockDocxConstructor).not.toHaveBeenCalled();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('keeps the self-loading path and creates no engine without highlights', async () => {
    renderHighlighted(undefined);

    await waitFor(() => expect(mockDocxConstructor).toHaveBeenCalledOnce());
    expect(mockLoad).toHaveBeenCalledWith('blob:docx');
    expect(mockDocumentLoad).not.toHaveBeenCalled();
    expect(mockFromDocument).not.toHaveBeenCalled();
  });

  it('destroys the viewer before the engine it borrowed', async () => {
    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());

    view.unmount();

    expect(teardownOrder).toEqual(['viewer', 'engine']);
  });

  it('discards a run collection that resolves after unmount', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- silences React's act() warning; the assertion is on call count, not behavior
      .mockImplementation(() => {});
    let resolveRuns: (runs: unknown[]) => void = () => undefined;
    mockCollectPageRuns.mockReturnValue(
      new Promise((resolve) => {
        resolveRuns = resolve;
      }),
    );

    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockCollectPageRuns).toHaveBeenCalled());
    view.unmount();
    await act(async () => {
      resolveRuns([run([3, 1])]);
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('renders no overlay when highlights are absent', async () => {
    renderHighlighted(undefined);

    await waitFor(() => expect(mockLoad).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
  });

  it('leaves no rectangle behind when a highlighted document is replaced by a plain one', async () => {
    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));

    view.unmount();
    renderHighlighted(undefined);

    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
  });

  it('marks exactly one of several highlights selected', async () => {
    mockCollectPageRuns.mockResolvedValue([
      run([3, 1]),
      run([4, 1]),
      run([5, 1]),
    ]);

    renderHighlighted(
      [highlight('a', [3, 1]), highlight('b', [4, 1]), highlight('c', [5, 1])],
      'b',
    );

    await waitFor(() => expect(getRects()).toHaveLength(3));
    const selected = getRects().filter(
      (rect) => rect.getAttribute('data-selected') === 'true',
    );
    expect(selected).toHaveLength(1);
  });

  it('marks every rectangle decorative and the overlay non-interactive', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(getRects()).toHaveLength(1));
    const overlay = screen.getByRole('region', { name: 'Cited locations' });
    expect(overlay.className).toContain('pointer-events-none');
    expect(getRects()[0].getAttribute('aria-hidden')).toBe('true');
    // eslint-disable-next-line testing-library/no-node-access -- no tab stop has an accessible role to query by; absence is only observable via the DOM
    expect(overlay.querySelector('[tabindex]')).toBeNull();
  });

  it('navigates to the cited page and announces it once', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockScrollToPage).toHaveBeenCalledWith(0));
    expect((await screen.findByRole('status')).textContent).toBe(
      'Scrolled to the cited location',
    );
  });

  it('still navigates when the range resolves to no rectangle', async () => {
    mockCollectPageRuns.mockResolvedValue([run([9, 9])]);

    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockScrollToPage).toHaveBeenCalled());
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancels a pending coalesced frame on teardown', async () => {
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
    vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(
      42 as unknown as number,
    );

    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());

    const scrollHost = screen
      .getByRole('document')
      // eslint-disable-next-line testing-library/no-node-access -- the scroll host is the viewer's own private DOM structure, not a queryable role
      .querySelector<HTMLElement>('div > div');
    act(() => {
      scrollHost?.dispatchEvent(new Event('scroll', { bubbles: false }));
    });

    view.unmount();

    expect(cancelFrame).toHaveBeenCalledWith(42);
    vi.restoreAllMocks();
  });

  it('does not surface an error state when a location cannot be resolved', async () => {
    mockCollectPageRuns.mockRejectedValue(new Error('layout not ready'));

    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
  });

  it('re-measures rectangles instead of reloading the document when highlights is a new array for the same url', async () => {
    /* Both runs are already resolvable on page 0, so the assertion below is
     * not confounded by `collectPage`'s own per-page cache having to refetch. */
    mockCollectPageRuns.mockResolvedValue([run([3, 1]), run([4, 1])]);

    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));
    expect(mockFromDocument).toHaveBeenCalledOnce();
    expect(mockDocumentLoad).toHaveBeenCalledOnce();

    view.rerender(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights: [highlight('b', [4, 1])],
          selectedHighlightId: 'b',
        }}
        fileName="report.docx"
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
        highlightsLabel="Cited locations"
        highlightNavigatedLabel="Scrolled to the cited location"
      />,
    );

    await waitFor(() =>
      expect(getRects()[0].getAttribute('data-selected')).toBe('true'),
    );
    /* Same url/format: the surface must not be torn down and reloaded just
     * because a new citation was clicked. */
    expect(mockFromDocument).toHaveBeenCalledOnce();
    expect(mockDocumentLoad).toHaveBeenCalledOnce();
  });
});

describe('OoxmlContent PPTX highlights', () => {
  const pptxHighlight = (slide: number, shapeId: string): OoxmlHighlight => ({
    id: 'a',
    locations: [
      {
        kind: OoxmlHighlightKind.PptxTextRange,
        slide,
        shapeId,
        start: 0,
        endExclusive: 5,
        text: 'Hello',
      },
    ],
  });

  const pptxRun = (shapeId: string) => ({
    shapeId,
    origin: 'slide',
    text: 'Hello',
    shapeX: 0,
    shapeY: 100,
    inShapeX: 0,
    inShapeY: 0,
    w: 50,
    h: 12,
    rotation: 0,
    font: '12px Arial',
  });

  const renderPptxHighlighted = (
    highlights: OoxmlHighlight[] | undefined,
    selectedHighlightId?: string,
  ) =>
    render(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:pptx',
          format: OoxmlFileType.Pptx,
          highlights,
          selectedHighlightId,
        }}
        fileName="deck.pptx"
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
        highlightsLabel="Cited locations"
        highlightNavigatedLabel="Scrolled to the cited location"
      />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(undefined);
    mockCollectSlideRuns.mockResolvedValue([pptxRun('7')]);
    teardownOrder.length = 0;
    importState.shouldFailDocx = false;
  });

  it('loads the engine once and creates the viewer from that instance', async () => {
    renderPptxHighlighted([pptxHighlight(1, '7')], 'a');

    await waitFor(() => expect(mockFromPresentation).toHaveBeenCalledOnce());
    expect(mockPresentationLoad).toHaveBeenCalledOnce();
    expect(mockPresentationLoad.mock.calls[0][0]).toBe('blob:pptx');
    expect(mockPptxConstructor).not.toHaveBeenCalled();
  });

  it("collects runs for the presentation's first slide, proving the 1-based slide converts to a 0-based index exactly once", async () => {
    renderPptxHighlighted([pptxHighlight(1, '7')], 'a');

    await waitFor(() => expect(mockCollectSlideRuns).toHaveBeenCalled());
    expect(mockCollectSlideRuns.mock.calls[0][0]).toBe(0);
  });

  it('destroys the viewer before the presentation it borrowed', async () => {
    const view = renderPptxHighlighted([pptxHighlight(1, '7')], 'a');
    await waitFor(() => expect(mockFromPresentation).toHaveBeenCalledOnce());

    view.unmount();

    expect(teardownOrder).toEqual(['viewer', 'engine']);
  });

  it('navigates to the cited slide and announces it once', async () => {
    renderPptxHighlighted([pptxHighlight(1, '7')], 'a');

    await waitFor(() => expect(mockScrollToSlide).toHaveBeenCalledWith(0));
    expect((await screen.findByRole('status')).textContent).toBe(
      'Scrolled to the cited location',
    );
  });

  it('yields no rectangle and no error for a slide number past the deck length', async () => {
    renderPptxHighlighted([pptxHighlight(99, '7')], 'a');

    await waitFor(() => expect(mockFromPresentation).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
    /* An out-of-range slide is not navigated to — the deck stays wherever it
     * already is rather than jumping to slide 0. */
    expect(mockScrollToSlide).not.toHaveBeenCalled();
  });

  it('renders no rectangle when the cited text does not match the resolved run text, and the deck still renders', async () => {
    mockCollectSlideRuns.mockResolvedValue([
      { ...pptxRun('7'), text: 'Goodbye' },
    ]);

    renderPptxHighlighted([pptxHighlight(1, '7')], 'a');

    await waitFor(() => expect(mockScrollToSlide).toHaveBeenCalledWith(0));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
  });

  it('renders no rectangle for a rotated shape, and the slide still renders and scrolls', async () => {
    mockCollectSlideRuns.mockResolvedValue([{ ...pptxRun('7'), rotation: 45 }]);

    renderPptxHighlighted([pptxHighlight(1, '7')], 'a');

    await waitFor(() => expect(mockScrollToSlide).toHaveBeenCalledWith(0));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
  });

  it('renders no rectangle for a flipped shape', async () => {
    mockCollectSlideRuns.mockResolvedValue([
      { ...pptxRun('7'), shapeFlipH: true },
    ]);

    renderPptxHighlighted([pptxHighlight(1, '7')], 'a');

    await waitFor(() => expect(mockFromPresentation).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
  });
});

describe('OoxmlContent XLSX highlights', () => {
  const xlsxHighlight = (sheet: string): OoxmlHighlight => ({
    id: 'a',
    locations: [
      {
        kind: OoxmlHighlightKind.XlsxCellRange,
        sheet,
        start: { row: 14, col: 3 },
      },
    ],
  });

  const renderXlsxHighlighted = (
    highlights: OoxmlHighlight[] | undefined,
    selectedHighlightId?: string,
  ) =>
    render(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:xlsx',
          format: OoxmlFileType.Xlsx,
          highlights,
          selectedHighlightId,
        }}
        fileName="ledger.xlsx"
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
        highlightsLabel="Cited locations"
        highlightNavigatedLabel="Scrolled to the cited location"
      />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(undefined);
    mockGetCellViewportRect.mockReturnValue(null);
    mockGoToSheet.mockResolvedValue(undefined);
    mockScrollToCell.mockResolvedValue(undefined);
    xlsxViewerState.sheetNames = ['Sheet1', 'Sheet2'];
    xlsxViewerState.sheetIndex = 0;
    teardownOrder.length = 0;
    /* Runs the coalesced recompute on a microtask instead of a real animation
     * frame, so an invalidation callback's effect can be awaited with
     * `waitFor` instead of a real frame delay. Deferred (not synchronous) so
     * `pendingFrame`'s own assignment — `pendingFrame = requestAnimationFrame(cb)`
     * — completes before `cb` runs and clears it, matching real ordering. */
    let frameId = 0;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        frameId += 1;
        queueMicrotask(() => callback(0));
        return frameId;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getRects = (): Element[] => [
    // eslint-disable-next-line testing-library/no-node-access -- the rects are decorative and carry no role of their own; counting them has no semantic query
    ...screen.getByRole('region', { name: 'Cited locations' }).children,
  ];

  it('switches to the target sheet before scrolling to the starting cell', async () => {
    renderXlsxHighlighted([xlsxHighlight('Sheet2')], 'a');

    await waitFor(() => expect(mockGoToSheet).toHaveBeenCalledWith(1));
    expect(mockScrollToCell).toHaveBeenCalledWith('C14', { align: 'center' });
  });

  it('does not switch sheets when the target sheet is already active', async () => {
    renderXlsxHighlighted([xlsxHighlight('Sheet1')], 'a');

    await waitFor(() =>
      expect(mockScrollToCell).toHaveBeenCalledWith('C14', {
        align: 'center',
      }),
    );
    expect(mockGoToSheet).not.toHaveBeenCalled();
  });

  it('yields no rectangle and no error for an unknown sheet name, and the workbook still opens', async () => {
    renderXlsxHighlighted([xlsxHighlight('Missing')], 'a');

    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
    expect(mockGoToSheet).not.toHaveBeenCalled();
  });

  it('renders a rectangle once the viewer reports the cell as measurable', async () => {
    mockGetCellViewportRect.mockReturnValue({
      x: 10,
      y: 20,
      width: 40,
      height: 15,
    });

    renderXlsxHighlighted([xlsxHighlight('Sheet1')], 'a');

    await waitFor(() => expect(getRects()).toHaveLength(1));
  });

  it('draws no rectangle when the viewer reports the cell as unmeasurable', async () => {
    mockGetCellViewportRect.mockReturnValue(null);

    renderXlsxHighlighted([xlsxHighlight('Sheet1')], 'a');

    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
  });

  it('recomputes the rectangle once the viewer reports the cell measurable after a scroll', async () => {
    mockGetCellViewportRect.mockReturnValue(null);

    renderXlsxHighlighted([xlsxHighlight('Sheet1')], 'a');
    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();

    const { onViewportChange } = mockXlsxConstructor.mock.calls[0][1] as {
      onViewportChange: () => void;
    };
    mockGetCellViewportRect.mockReturnValue({
      x: 10,
      y: 20,
      width: 40,
      height: 15,
    });
    act(() => {
      onViewportChange();
    });

    await waitFor(() => expect(getRects()).toHaveLength(1));
  });

  it('recomputes the rectangle on a scale change', async () => {
    mockGetCellViewportRect.mockReturnValueOnce(null).mockReturnValue({
      x: 10,
      y: 20,
      width: 40,
      height: 15,
    });

    renderXlsxHighlighted([xlsxHighlight('Sheet1')], 'a');
    await waitFor(() => expect(mockXlsxConstructor).toHaveBeenCalledOnce());

    const { onScaleChange } = mockXlsxConstructor.mock.calls[0][1] as {
      onScaleChange: () => void;
    };
    act(() => {
      onScaleChange();
    });

    await waitFor(() => expect(getRects()).toHaveLength(1));
  });

  it('removes the highlight when switching sheets away and restores it when switching back', async () => {
    mockGetCellViewportRect.mockReturnValue({
      x: 10,
      y: 20,
      width: 40,
      height: 15,
    });

    renderXlsxHighlighted([xlsxHighlight('Sheet1')], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));

    const { onSheetChange } = mockXlsxConstructor.mock.calls[0][1] as {
      onSheetChange: () => void;
    };

    xlsxViewerState.sheetIndex = 1;
    act(() => {
      onSheetChange();
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Cited locations' }),
      ).toBeNull(),
    );

    xlsxViewerState.sheetIndex = 0;
    act(() => {
      onSheetChange();
    });
    await waitFor(() => expect(getRects()).toHaveLength(1));
  });
});
