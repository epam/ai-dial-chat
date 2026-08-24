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
} = vi.hoisted(() => ({
  mockDocxConstructor: vi.fn(),
  mockXlsxConstructor: vi.fn(),
  mockPptxConstructor: vi.fn(),
  mockLoad: vi.fn(),
  mockDestroy: vi.fn(),
}));

vi.mock('@silurus/ooxml/docx', () => ({
  DocxScrollViewer: function (...args: unknown[]) {
    mockDocxConstructor(...args);
    return { load: mockLoad, destroy: mockDestroy };
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

const renderContent = (format: OoxmlFileType) =>
  render(
    <OoxmlContent
      content={{
        type: AttachmentContentType.Ooxml,
        url: `blob:${format}`,
        format,
      }}
      fileName={`report.${format}`}
      loadErrorLabel="Failed to load file"
    />,
  );

describe('OoxmlContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(undefined);
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
});
