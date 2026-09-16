import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OoxmlHighlight } from '../../../models/attachment-canvas';
import {
  deliverResizeObserverEntry,
  isElementObservedByResizeObserver,
  resetResizeObserverMock,
} from '../../../test-setup';
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
  mockWaitUntilLayoutComplete,
  mockDocxScrollTo,
  mockPresentationLoad,
  mockCollectSlideRuns,
  mockFromPresentation,
  mockScrollToSlide,
  mockGetCellViewportRect,
  mockGoToSheet,
  mockScrollToCell,
  xlsxViewerState,
  docxViewerState,
  docxDocumentState,
  docxScrollHostState,
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
  /* Resolves immediately by default so existing tests are unaffected; a test
   * can `.mockReturnValue`/`.mockImplementation` a controllable promise to
   * exercise the late-layout-completion path. */
  mockWaitUntilLayoutComplete: vi.fn(),
  /* Records every `scrollTo` call on the mock scroll host so a test can
   * assert the exact target navigation computed. */
  mockDocxScrollTo: vi.fn(),
  mockPresentationLoad: vi.fn(),
  mockCollectSlideRuns: vi.fn(),
  mockFromPresentation: vi.fn(),
  mockScrollToSlide: vi.fn(),
  mockGetCellViewportRect: vi.fn(),
  mockGoToSheet: vi.fn(),
  mockScrollToCell: vi.fn(),
  /* Mutable so a test can move the "active sheet" before rendering. */
  xlsxViewerState: { sheetNames: ['Sheet1'], sheetIndex: 0 },
  /* Mutable so a test can drive the mock DOCX viewer's scale before firing
   * its captured `onScaleChange` callback. */
  docxViewerState: { scale: 1 },
  /* Mutable so a test can simulate progressive layout: `pageCount` starts
   * partial and grows once `waitUntilLayoutComplete` resolves, mirroring the
   * real vendor build this fixes navigation against. */
  docxDocumentState: { pageCount: 1 },
  /* Mutable geometry for the mock scroll host, read by `resolveDocxScrollTarget`.
   * Sized generously by default so a navigation test's target is not clamped
   * to 0 by happenstance. */
  docxScrollHostState: {
    clientWidth: 816,
    clientHeight: 600,
    scrollWidth: 816,
    scrollHeight: 3000,
    scrollLeft: 0,
    scrollTop: 0,
  },
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
   * marked with an inline `overflow:auto`, which is how the overlay finds it.
   * The host's box geometry is controllable through `docxScrollHostState`,
   * and its `scrollTo` is a plain spy so a test can assert the exact target
   * a navigation computed. */
  DocxScrollViewer.fromDocument = (container, ...rest) => {
    mockFromDocument(container, ...rest);
    const wrapper = document.createElement('div');
    const scrollHost = document.createElement('div');
    scrollHost.style.overflow = 'auto';
    for (const prop of [
      'clientWidth',
      'clientHeight',
      'scrollWidth',
      'scrollHeight',
      'scrollLeft',
      'scrollTop',
    ] as const) {
      Object.defineProperty(scrollHost, prop, {
        get: () => docxScrollHostState[prop],
        configurable: true,
      });
    }
    scrollHost.scrollTo = mockDocxScrollTo;
    wrapper.appendChild(scrollHost);
    container.appendChild(wrapper);
    return {
      getScale: () => docxViewerState.scale,
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
          get pageCount() {
            return docxDocumentState.pageCount;
          },
          pageSize: () => ({ widthPt: 612, heightPt: 792 }),
          collectPageRuns: mockCollectPageRuns,
          waitUntilLayoutComplete: mockWaitUntilLayoutComplete,
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

/* jsdom does not implement `Element.scrollIntoView`; give every element a
 * no-op stub once so `vi.spyOn` below has a real property to wrap. */
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => undefined;
}

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

  /* The docx page in these tests is 612pt wide, so its scale-1 CSS width —
   * `612 * 4/3` — is the width `collectPageRuns` is called with today (at
   * `getScale() === 1`) and, after the fix, the fixed reference width it is
   * called with regardless of scale. Runs are width-dependent because
   * `CollectPageRunsOptions.width` places every returned coordinate in that
   * width's pixel space (`node_modules/@silurus/ooxml/dist/types/docx.d.ts`);
   * defaulting to this reference width reproduces today's fixed numbers. */
  const REFERENCE_DOCX_WIDTH = (612 * 4) / 3;

  const run = (path: number[], width: number = REFERENCE_DOCX_WIDTH) => {
    const scale = width / REFERENCE_DOCX_WIDTH;
    return {
      source: { story: 'body', storyInstance: 'main', path },
      sourceRunIndex: 0,
      text: 'Hello',
      x: 0 * scale,
      y: 100 * scale,
      w: 50 * scale,
      h: 12 * scale,
      fontSize: 12 * scale,
      font: `${12 * scale}px Arial`,
    };
  };

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

  /** Reads the mock DOCX viewer's `onScaleChange` callback out of its `fromDocument` call and fires it after moving the mock scale. */
  const changeDocxScale = async (scale: number): Promise<void> => {
    docxViewerState.scale = scale;
    const { onScaleChange } = mockFromDocument.mock.calls[0][2] as {
      onScaleChange: () => void;
    };
    await act(async () => {
      onScaleChange();
    });
  };

  /** The viewer container the renderer owns and — once §6 lands — observes. */
  const getViewerContainer = (): HTMLElement => screen.getByRole('document');

  /*
   * The vendor's own private scroll host, found the same way `findScrollHost`
   * does — the first descendant `div` with an inline `overflow:auto`, not
   * merely "a div nested one level deep" (`div > div` also matches the mock
   * viewer's non-scrolling wrapper, which sits at the same nesting depth).
   */
  const getScrollHost = (): HTMLElement | null => {
    // eslint-disable-next-line testing-library/no-node-access -- the scroll host is the viewer's own private DOM structure, not a queryable role
    for (const element of getViewerContainer().querySelectorAll<HTMLElement>(
      'div',
    )) {
      if (element.style.overflow === 'auto') return element;
    }
    return null;
  };

  const setScrollHostClientWidth = (width: number): void => {
    docxScrollHostState.clientWidth = width;
  };

  /** Overrides the mock scroll host's box geometry read by `resolveDocxScrollTarget`. */
  const setDocxScrollHostBox = (
    box: Partial<typeof docxScrollHostState>,
  ): void => {
    Object.assign(docxScrollHostState, box);
  };

  /** A `waitUntilLayoutComplete` a test can resolve or reject on demand, instead of the default immediate resolution. */
  const deferDocxLayoutCompletion = (): {
    resolve: () => void;
    reject: (error: Error) => void;
  } => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    /* Vitest fails a test on an unhandled rejection even when the caller
     * later awaits it; a no-op catch keeps a rejected-but-not-yet-awaited
     * deferred quiet between the reject() call and navigate()'s own catch. */
    promise.catch(() => undefined);
    mockWaitUntilLayoutComplete.mockReturnValue(promise);
    return { resolve, reject };
  };

  const resizeViewerContainer = async (): Promise<void> => {
    await act(async () => {
      deliverResizeObserverEntry(getViewerContainer());
    });
  };

  /*
   * Mount already schedules one coalesced frame on its own (the separate
   * `useEffect` that re-measures whenever `highlights` changes runs once on
   * mount too), so a test that counts `requestAnimationFrame` calls across a
   * synchronous burst must first let that frame settle — otherwise the
   * burst's first call finds `pendingFrame` already occupied by the mount's
   * own scheduling rather than by anything the burst itself did.
   */
  const flushPendingFrame = async (): Promise<void> => {
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });
  };

  /* Fails any test in this block outright if a DOCX navigation ever calls
   * `Element.scrollIntoView` — it would scroll every scrollable ancestor and
   * drag the surrounding chat page along with the preview, which navigation
   * must never do (see the scroll-containment requirement). */
  let scrollIntoViewSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(undefined);
    /* Defaults to the reference-width numbers regardless of the `width` the
     * caller passes, mirroring the fixed-reference-width collection this
     * change moves DOCX to; a test can still assert on the `width` actually
     * requested via `mockCollectPageRuns.mock.calls`. */
    mockCollectPageRuns.mockImplementation(
      (_pageIndex: number, options: { width: number }) =>
        Promise.resolve([run([3, 1], options.width)]),
    );
    mockCollectSlideRuns.mockResolvedValue([]);
    mockGetCellViewportRect.mockReturnValue(null);
    mockGoToSheet.mockResolvedValue(undefined);
    mockScrollToCell.mockResolvedValue(undefined);
    mockWaitUntilLayoutComplete.mockResolvedValue(undefined);
    xlsxViewerState.sheetNames = ['Sheet1'];
    xlsxViewerState.sheetIndex = 0;
    docxViewerState.scale = 1;
    docxDocumentState.pageCount = 1;
    Object.assign(docxScrollHostState, {
      clientWidth: 816,
      clientHeight: 600,
      scrollWidth: 816,
      scrollHeight: 3000,
      scrollLeft: 0,
      scrollTop: 0,
    });
    teardownOrder.length = 0;
    importState.shouldFailDocx = false;
    scrollIntoViewSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {
        throw new Error(
          'Element.scrollIntoView must not be called by DOCX navigation — it scrolls every scrollable ancestor.',
        );
      });
  });

  afterEach(() => {
    resetResizeObserverMock();
    scrollIntoViewSpy.mockRestore();
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

  it('navigates to the cited passage and announces it once', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
    /* Passage-level navigation, not `scrollToPage`: a rectangle resolved, so
     * the surface computes an absolute scroll target instead of stopping at
     * the page's top edge. */
    expect(mockScrollToPage).not.toHaveBeenCalled();
    expect((await screen.findByRole('status')).textContent).toBe(
      'Scrolled to the cited location',
    );
  });

  it('brings an offscreen passage low on its page into the visible area', async () => {
    /* Near the bottom of an 1056px-tall (scale-1) page, well past the
     * default 600px-tall client viewport. */
    mockCollectPageRuns.mockResolvedValue([{ ...run([3, 1]), y: 900 }]);

    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
    const [{ top }] = mockDocxScrollTo.mock.calls[0];
    /* offset.top (16px padding) + y(900) - the 150px lead margin. */
    expect(top).toBeCloseTo(16 + 900 - 600 * 0.25, 5);
    expect(top).toBeGreaterThan(0);
  });

  it('does not re-navigate when the viewer scale changes', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());

    await changeDocxScale(2);
    await waitFor(() => expect(getRects()).toHaveLength(1));

    /* Navigation is one-shot per selection: a scale change re-measures
     * placement but must not scroll again. */
    expect(mockDocxScrollTo).toHaveBeenCalledOnce();
  });

  it('still navigates to the page when the range resolves to no rectangle', async () => {
    /* Same path (so a page is found) but different text, so the resolved
     * text fails the location's own validation and no rectangle is produced. */
    mockCollectPageRuns.mockResolvedValue([{ ...run([3, 1]), text: 'Nope!' }]);

    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockScrollToPage).toHaveBeenCalledWith(0));
    expect(mockDocxScrollTo).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect((await screen.findByRole('status')).textContent).toBe(
      'Scrolled to the cited location',
    );
  });

  it('does not scroll at all when the location cannot be resolved to any page', async () => {
    /* A different path on the only page, past the target in document order —
     * `findPages` never finds a matching page for `[3, 1]`. */
    mockCollectPageRuns.mockResolvedValue([run([9, 9])]);

    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());
    await flushPendingFrame();

    expect(mockScrollToPage).not.toHaveBeenCalled();
    expect(mockDocxScrollTo).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')?.textContent).toBeFalsy();
    expect(
      screen.queryByRole('region', { name: 'Cited locations' }),
    ).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('switches to a citation on a later page, then to one on an earlier page', async () => {
    /* Both pages' content is fixed up front — `collectPage` caches a page's
     * runs for the life of the document, so reassigning the mock mid-test
     * would leave a later selection reading the earlier page's stale cache. */
    docxDocumentState.pageCount = 2;
    mockCollectPageRuns.mockImplementation(
      (pageIndex: number, options: { width: number }) =>
        Promise.resolve(
          pageIndex === 0
            ? [run([3, 1], options.width)]
            : [run([5, 1], options.width)],
        ),
    );

    const view = renderHighlighted(
      [highlight('a', [3, 1]), highlight('b', [5, 1])],
      undefined,
    );
    await waitFor(() => expect(getRects()).toHaveLength(2));

    view.rerender(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights: [highlight('a', [3, 1]), highlight('b', [5, 1])],
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

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
    const firstTarget = mockDocxScrollTo.mock.calls[0][0] as { top: number };
    expect(firstTarget.top).toBeGreaterThan(0);

    /* Switch back to a citation on page 0 — the preview must scroll
     * backwards, not stay parked on the later page. */
    view.rerender(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights: [highlight('a', [3, 1]), highlight('b', [5, 1])],
          selectedHighlightId: 'a',
        }}
        fileName="report.docx"
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
        highlightsLabel="Cited locations"
        highlightNavigatedLabel="Scrolled to the cited location"
      />,
    );

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledTimes(2));
    const secondTarget = mockDocxScrollTo.mock.calls[1][0] as { top: number };
    expect(secondTarget.top).toBeLessThan(firstTarget.top);
  });

  it('scales the navigation target proportionally at a non-default scale', async () => {
    docxViewerState.scale = 2;
    renderHighlighted([highlight('a', [3, 1])], 'a');

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
    const [{ top }] = mockDocxScrollTo.mock.calls[0];
    /* offset.top (16px, scale-independent) + y(100) * scale(2), minus the
     * 25%-of-clientHeight lead (clamped to the offset itself here). */
    const rectTop = 16 + 100 * 2;
    const lead = Math.min(600 * 0.25, rectTop);
    expect(top).toBeCloseTo(rectTop - lead, 5);
  });

  it('brings the cited passage into view against a resized container', async () => {
    /* Near the bottom of the page, so the lead margin — which scales with
     * `clientHeight` — actually changes the computed target. */
    mockCollectPageRuns.mockResolvedValue([{ ...run([3, 1]), y: 900 }]);
    /* No selection yet, so mounting only measures — it does not navigate. */
    const view = renderHighlighted([highlight('a', [3, 1])], undefined);
    await waitFor(() => expect(getRects()).toHaveLength(1));

    setDocxScrollHostBox({ clientHeight: 300, scrollHeight: 2000 });
    await resizeViewerContainer();

    /* Selecting the citation now triggers the first navigation, after the
     * resize — the target must reflect the new host box, not the one at mount. */
    view.rerender(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights: [highlight('a', [3, 1])],
          selectedHighlightId: 'a',
        }}
        fileName="report.docx"
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
        highlightsLabel="Cited locations"
        highlightNavigatedLabel="Scrolled to the cited location"
      />,
    );

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
    const [{ top }] = mockDocxScrollTo.mock.calls[0];
    /* offset.top (16px) + y(900), minus a lead margin of 25% of the *resized*
     * 300px client height — not the 600px default at mount. */
    const rectTop = 16 + 900;
    const lead = Math.min(300 * 0.25, rectTop);
    expect(top).toBeCloseTo(rectTop - lead, 5);
  });

  it('waits for layout completion before navigating to a page laid out after first paint', async () => {
    docxDocumentState.pageCount = 1;
    const layout = deferDocxLayoutCompletion();
    mockCollectPageRuns.mockImplementation(
      (pageIndex: number, options: { width: number }) =>
        Promise.resolve(pageIndex === 2 ? [run([9, 1], options.width)] : []),
    );

    renderHighlighted([highlight('a', [9, 1])], 'a');
    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());
    await flushPendingFrame();

    /* Layout still in progress: no page carries the citation yet, so no
     * scroll of any kind has happened — least of all a fallback to page one. */
    expect(mockScrollToPage).not.toHaveBeenCalled();
    expect(mockDocxScrollTo).not.toHaveBeenCalled();

    /* Layout finishes and publishes the page that carries the citation. */
    docxDocumentState.pageCount = 3;
    await act(async () => {
      layout.resolve();
    });

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
    expect(mockScrollToPage).not.toHaveBeenCalledWith(0);
  });

  it('does not block rectangle measurement on a pending layout-completion wait', async () => {
    const layout = deferDocxLayoutCompletion();

    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());

    /* Measurement (unlike navigation) does not await layout completion, so a
     * scale change still produces a recomputed rectangle while the layout
     * wait is still pending. */
    await changeDocxScale(2);
    await waitFor(() => expect(getRects()).toHaveLength(1));
    expect(mockDocxScrollTo).not.toHaveBeenCalled();

    await act(async () => {
      layout.resolve();
    });
    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
  });

  it('degrades gracefully when layout completion fails', async () => {
    const layout = deferDocxLayoutCompletion();
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockFromDocument).toHaveBeenCalledOnce());

    await act(async () => {
      layout.reject(new Error('layout failed'));
    });

    expect(mockScrollToPage).not.toHaveBeenCalled();
    expect(mockDocxScrollTo).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('settles on the later of two rapidly selected citations', async () => {
    /* Both citations resolve on page 0, so the only thing that can hold `a`'s
     * navigation open long enough for `b` to overtake it is the layout-
     * completion await every `navigate` call starts with: `a`'s call gets a
     * still-pending promise, and every later call (`b`'s) gets one already
     * resolved. */
    let resolveLayoutForA: () => void = () => undefined;
    const pendingLayoutForA = new Promise<void>((resolve) => {
      resolveLayoutForA = resolve;
    });
    mockWaitUntilLayoutComplete
      .mockReturnValueOnce(pendingLayoutForA)
      .mockResolvedValue(undefined);
    mockCollectPageRuns.mockResolvedValue([run([3, 1]), run([4, 1])]);

    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() =>
      expect(mockWaitUntilLayoutComplete).toHaveBeenCalledTimes(1),
    );

    /* `b` is selected while `a`'s navigation is still waiting on layout. */
    view.rerender(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights: [highlight('a', [3, 1]), highlight('b', [4, 1])],
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
    /* `b`'s own layout wait resolves immediately, so it navigates first. */
    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());

    /* `a`'s stale navigation now resumes, after `b` has already completed. */
    await act(async () => {
      resolveLayoutForA();
    });

    /* Still exactly one scroll — the superseded, later-resolving `a`
     * performed none. */
    expect(mockDocxScrollTo).toHaveBeenCalledOnce();
    expect(mockScrollToPage).not.toHaveBeenCalled();
  });

  it('does not scroll back to the highlight after the user scrolls, zooms, or resizes', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());

    await changeDocxScale(2);
    await waitFor(() => expect(getRects()).toHaveLength(1));
    await resizeViewerContainer();
    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());

    const scrollHost = getScrollHost();
    act(() => {
      scrollHost?.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    await flushPendingFrame();

    expect(mockDocxScrollTo).toHaveBeenCalledOnce();
  });

  it('does not scroll when the viewer scroll host cannot be located', async () => {
    /* No selection yet, so mounting does not navigate. */
    const view = renderHighlighted([highlight('a', [3, 1])], undefined);
    await waitFor(() => expect(getRects()).toHaveLength(1));

    /* Remove the inline `overflow:auto` marker `findScrollHost` looks for,
     * then select the citation. */
    const scrollHost = getScrollHost();
    if (scrollHost != null) scrollHost.style.overflow = '';

    view.rerender(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights: [highlight('a', [3, 1])],
          selectedHighlightId: 'a',
        }}
        fileName="report.docx"
        loadErrorLabel="Failed to load file"
        formulaLabel="Formula"
        formulaLabelClassName="dial-italic-text"
        highlightsLabel="Cited locations"
        highlightNavigatedLabel="Scrolled to the cited location"
      />,
    );
    await flushPendingFrame();

    expect(mockDocxScrollTo).not.toHaveBeenCalled();
    expect(mockScrollToPage).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')?.textContent).toBeFalsy();
  });

  it('announces a second citation navigated to in an already-open preview', async () => {
    /* Both citations resolve from the same, single-page run collection —
     * `collectPage` caches a page's runs for the document's lifetime, so a
     * later `mockResolvedValue` swap would never be seen for an
     * already-collected page. */
    mockCollectPageRuns.mockResolvedValue([run([3, 1]), run([4, 1])]);

    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledOnce());
    expect((await screen.findByRole('status')).textContent).toBe(
      'Scrolled to the cited location',
    );

    view.rerender(
      <OoxmlContent
        content={{
          type: AttachmentContentType.Ooxml,
          url: 'blob:docx',
          format: OoxmlFileType.Docx,
          highlights: [highlight('a', [3, 1]), highlight('b', [4, 1])],
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

    await waitFor(() => expect(mockDocxScrollTo).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('status')).textContent).toBe(
      'Scrolled to the cited location',
    );
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

  it('collects run geometry once and keeps the rectangle correctly sized across several scale changes', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));
    const widthAtScale1 = parseFloat(
      (getRects()[0] as HTMLElement).style.width,
    );

    await changeDocxScale(2);
    await waitFor(() => {
      const width = parseFloat((getRects()[0] as HTMLElement).style.width);
      expect(width).toBeCloseTo(widthAtScale1 * 2, 5);
    });

    await changeDocxScale(0.5);
    await waitFor(() => {
      const width = parseFloat((getRects()[0] as HTMLElement).style.width);
      expect(width).toBeCloseTo(widthAtScale1 * 0.5, 5);
    });

    await changeDocxScale(1);
    await waitFor(() => {
      const width = parseFloat((getRects()[0] as HTMLElement).style.width);
      expect(width).toBeCloseTo(widthAtScale1, 5);
    });

    expect(mockCollectPageRuns).toHaveBeenCalledOnce();
  });

  it('does not retain a previous scale rectangle dimensions after a scale change', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));
    const initialWidth = parseFloat((getRects()[0] as HTMLElement).style.width);
    const initialHeight = parseFloat(
      (getRects()[0] as HTMLElement).style.height,
    );

    await changeDocxScale(2);

    await waitFor(() => {
      const rect = getRects()[0] as HTMLElement;
      const width = parseFloat(rect.style.width);
      const height = parseFloat(rect.style.height);
      expect(width).not.toBeCloseTo(initialWidth, 5);
      expect(height).not.toBeCloseTo(initialHeight, 5);
      expect(width).toBeCloseTo(initialWidth * 2, 5);
      expect(height).toBeCloseTo(initialHeight * 2, 5);
    });
  });

  it('observes the viewer container and recomputes placement on a resize that emits no onScaleChange', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));

    /* This is the clamped-refit/unchanged-fit-width case: the container's box
     * changes but the vendor never calls `onScaleChange`. */
    expect(isElementObservedByResizeObserver(getViewerContainer())).toBe(true);

    const initialLeft = parseFloat((getRects()[0] as HTMLElement).style.left);
    setScrollHostClientWidth(1000);
    await resizeViewerContainer();

    await waitFor(() => {
      const left = parseFloat((getRects()[0] as HTMLElement).style.left);
      expect(left).not.toBeCloseTo(initialLeft, 5);
    });
    /* Placement is pure arithmetic over already-resolved fractions: a resize
     * must not trigger another parse of the page's runs. */
    expect(mockCollectPageRuns).toHaveBeenCalledOnce();
  });

  it('re-centres the rectangle against the new container width', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));

    setScrollHostClientWidth(1000);
    await resizeViewerContainer();

    /* `resolveSurfaceOffset`'s `left = max(paddingLeft, (hostClientWidth -
     * pageWidth) / 2)`: at the default 16px padding, an 816px-wide page, and
     * a 1000px host, that is `max(16, (1000 - 816) / 2) = 92`. The cited run
     * starts at the page's own left edge, so the rendered `left` is exactly
     * that offset. */
    await waitFor(() => {
      const left = parseFloat((getRects()[0] as HTMLElement).style.left);
      expect(left).toBeCloseTo(92, 5);
    });
  });

  it('coalesces a resize burst into at most one recompute per frame', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));
    await flushPendingFrame();

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    const container = getViewerContainer();

    act(() => {
      deliverResizeObserverEntry(container);
      deliverResizeObserverEntry(container);
      deliverResizeObserverEntry(container);
    });

    expect(rafSpy).toHaveBeenCalledOnce();
    await waitFor(() => expect(getRects()).toHaveLength(1));
    rafSpy.mockRestore();
  });

  it('stops observing the container once the viewer is torn down', async () => {
    const view = renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));
    const container = getViewerContainer();
    expect(isElementObservedByResizeObserver(container)).toBe(true);

    view.unmount();

    expect(isElementObservedByResizeObserver(container)).toBe(false);
  });

  it('introduces no cumulative drift across interleaved zoom and resize', async () => {
    renderHighlighted([highlight('a', [3, 1])], 'a');
    await waitFor(() => expect(getRects()).toHaveLength(1));
    setScrollHostClientWidth(1000);
    await resizeViewerContainer();
    const [leftAt1000x1, topAt1000x1] = await waitFor(() => {
      const rect = getRects()[0] as HTMLElement;
      const left = parseFloat(rect.style.left);
      const top = parseFloat(rect.style.top);
      expect(left).toBeCloseTo(92, 5);
      return [left, top];
    });

    await changeDocxScale(2);
    setScrollHostClientWidth(600);
    await resizeViewerContainer();
    await waitFor(() => {
      const left = parseFloat((getRects()[0] as HTMLElement).style.left);
      expect(left).not.toBeCloseTo(leftAt1000x1, 5);
    });

    await changeDocxScale(1);
    setScrollHostClientWidth(1000);
    await resizeViewerContainer();

    await waitFor(() => {
      const rect = getRects()[0] as HTMLElement;
      expect(parseFloat(rect.style.left)).toBeCloseTo(leftAt1000x1, 5);
      expect(parseFloat(rect.style.top)).toBeCloseTo(topAt1000x1, 5);
    });
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
