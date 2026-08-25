import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttachmentContentType,
  OoxmlFileType,
} from '../../../types/attachment-canvas';
import { OoxmlContent } from '../OoxmlContent';

const {
  mockDocxConstructor,
  mockXlsxConstructor,
  mockPptxConstructor,
  mockLoad,
  mockDestroy,
  importState,
} = vi.hoisted(() => ({
  mockDocxConstructor: vi.fn(),
  mockXlsxConstructor: vi.fn(),
  mockPptxConstructor: vi.fn(),
  mockLoad: vi.fn(),
  mockDestroy: vi.fn(),
  /* Lets one test simulate a failed chunk load: reading the export throws
   * while the module specifier itself still resolves. */
  importState: { shouldFailDocx: false },
}));

vi.mock('@silurus/ooxml/docx', () => ({
  get DocxScrollViewer() {
    if (importState.shouldFailDocx) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return function (...args: unknown[]) {
      mockDocxConstructor(...args);
      return { load: mockLoad, destroy: mockDestroy };
    };
  },
}));

vi.mock('@silurus/ooxml/xlsx', () => ({
  XlsxViewer: function (...args: unknown[]) {
    mockXlsxConstructor(...args);
    return { load: mockLoad, destroy: mockDestroy };
  },
}));

vi.mock('@silurus/ooxml/pptx', () => ({
  PptxScrollViewer: function (...args: unknown[]) {
    mockPptxConstructor(...args);
    return { load: mockLoad, destroy: mockDestroy };
  },
}));

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
    />,
  );

describe('OoxmlContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(undefined);
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
      />,
    );
    await waitFor(() => expect(mockLoad).toHaveBeenCalledWith('blob:first'));

    view.rerender(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Docx, 'blob:second')}
        loadErrorLabel="Failed to load file"
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
      />,
    );
    await waitFor(() => expect(mockDocxConstructor).toHaveBeenCalledOnce());

    view.rerender(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Xlsx)}
        loadErrorLabel="Failed to load file"
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
      />,
    );
    await waitFor(() => expect(mockDocxConstructor).toHaveBeenCalledOnce());

    view.rerender(
      <OoxmlContent
        content={makeContent(OoxmlFileType.Docx)}
        loadErrorLabel="Failed to load file"
      />,
    );

    expect(mockDocxConstructor).toHaveBeenCalledOnce();
    expect(mockDestroy).not.toHaveBeenCalled();
  });
});
