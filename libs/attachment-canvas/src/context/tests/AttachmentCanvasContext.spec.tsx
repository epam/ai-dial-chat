import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentContentType } from '../../types/attachment-canvas';
import {
  AttachmentCanvasProvider,
  useAttachmentCanvas,
} from '../AttachmentCanvasContext';

describe('AttachmentCanvasProvider', () => {
  beforeEach(() => {
    URL.revokeObjectURL = vi.fn();
  });

  const renderCanvas = () =>
    renderHook(() => useAttachmentCanvas(), {
      wrapper: AttachmentCanvasProvider,
    });

  it('revokes the previous blob object URL when new content replaces it', () => {
    const { result } = renderCanvas();

    act(() => {
      result.current.openCanvas({
        type: AttachmentContentType.Pdf,
        url: 'blob:mock-pdf-url-1',
      });
    });

    act(() => {
      result.current.openCanvas({
        type: AttachmentContentType.Pdf,
        url: 'blob:mock-pdf-url-2',
      });
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-pdf-url-1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:mock-pdf-url-2');
  });

  it('revokes the current blob object URL on unmount', () => {
    const { result, unmount } = renderCanvas();

    act(() => {
      result.current.openCanvas({
        type: AttachmentContentType.Image,
        url: 'blob:mock-image-url',
      });
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-image-url');
  });

  it('does not revoke a remote (non-blob) URL', () => {
    const { result } = renderCanvas();

    act(() => {
      result.current.openCanvas({
        type: AttachmentContentType.Pdf,
        url: 'https://example.com/doc.pdf',
      });
    });

    act(() => {
      result.current.openCanvas({
        type: AttachmentContentType.PlainText,
        text: '',
      });
    });

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the current blob URL when the canvas is closed', () => {
    const { result } = renderCanvas();

    act(() => {
      result.current.openCanvas({
        type: AttachmentContentType.Pdf,
        url: 'blob:mock-close-url',
      });
    });

    act(() => {
      result.current.closeCanvas();
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-close-url');
  });

  it('does not revoke content types with no url (e.g. PlainText)', () => {
    const { result, unmount } = renderCanvas();

    act(() => {
      result.current.openCanvas({
        type: AttachmentContentType.PlainText,
        text: 'hello',
      });
    });

    unmount();

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
