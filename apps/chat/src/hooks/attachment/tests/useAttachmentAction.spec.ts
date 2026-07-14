import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttachmentAction } from '../useAttachmentAction';

const mockOpenCanvas = vi.fn();

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useAttachmentCanvas: () => ({ openCanvas: mockOpenCanvas }),
  };
});

const makeAttachment = (
  overrides?: Partial<DisplayAttachment>,
): DisplayAttachment => ({
  id: 'att1',
  name: 'file.pdf',
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('useAttachmentAction', () => {
  let anchorClickSpy: ReturnType<typeof vi.fn>;
  let anchorMock: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
  };
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    anchorClickSpy = vi.fn();
    const original = document.createElement.bind(document);
    anchorMock = { href: '', download: '', click: anchorClickSpy };
    createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return anchorMock as unknown as HTMLElement;
        }
        return original(tagName);
      });
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    windowOpenSpy.mockRestore();
  });

  it('triggers an anchor download for a DIAL file attachment', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({
      url: 'files/my-bucket/folder/file.pdf',
    });

    result.current.handleAttachmentClick(attachment);

    expect(anchorClickSpy).toHaveBeenCalledOnce();
    expect(anchorMock.href).toContain('/api/v1/files/download');
    expect(anchorMock.download).toBe('file.pdf');
  });

  it('is a no-op for an attachment without a DIAL file URL', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({ url: 'https://external.com/file.pdf' });

    result.current.handleAttachmentClick(attachment);

    expect(anchorClickSpy).not.toHaveBeenCalled();
  });

  it('is a no-op for an attachment with no URL', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({ url: undefined });

    result.current.handleAttachmentClick(attachment);

    expect(anchorClickSpy).not.toHaveBeenCalled();
  });

  it('opens the canvas scrolled to the page for a PDF referenceUrl with a page anchor', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({
      url: undefined,
      referenceUrl: 'files/my-bucket/report.pdf#page=5',
    });

    result.current.handleAttachmentClick(attachment);

    expect(mockOpenCanvas).toHaveBeenCalledOnce();
    expect(anchorClickSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('downloads a DIAL-file referenceUrl that is not a PDF', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({
      url: undefined,
      referenceUrl: 'files/my-bucket/notes.md',
    });

    result.current.handleAttachmentClick(attachment);

    expect(mockOpenCanvas).not.toHaveBeenCalled();
    expect(anchorClickSpy).toHaveBeenCalledOnce();
  });

  it('opens an external referenceUrl in a new tab', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({
      url: undefined,
      referenceUrl: 'https://example.com/source',
    });

    result.current.handleAttachmentClick(attachment);

    expect(mockOpenCanvas).not.toHaveBeenCalled();
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://example.com/source',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('returns a stable callback reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useAttachmentAction());
    const first = result.current.handleAttachmentClick;
    rerender();
    expect(result.current.handleAttachmentClick).toBe(first);
  });
});
