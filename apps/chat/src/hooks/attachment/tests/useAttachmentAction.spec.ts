import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadAttachment,
  isDownloadableAttachment,
  useAttachmentAction,
} from '../useAttachmentAction';

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

/*
 * `triggerAnchorDownload` appends its temporary anchor to the document and only
 * removes it on a timer, so with fake timers the anchor is still queryable while
 * the assertions run.
 */
const getDownloadAnchor = (): HTMLAnchorElement | null =>
  screen
    .queryAllByRole<HTMLAnchorElement>('link', { hidden: true })
    .find((anchor) => anchor.hasAttribute('download')) ?? null;

describe('useAttachmentAction', () => {
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.innerHTML = '';
    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.useRealTimers();
    anchorClickSpy.mockRestore();
    windowOpenSpy.mockRestore();
  });

  it('triggers an anchor download for a DIAL file attachment', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({
      url: 'files/my-bucket/folder/file.pdf',
    });

    result.current.handleAttachmentClick(attachment);

    expect(anchorClickSpy).toHaveBeenCalledOnce();
    expect(getDownloadAnchor()?.href).toContain('/api/v1/files/download');
    expect(getDownloadAnchor()?.download).toBe('file.pdf');
  });

  it('downloads an inline attachment that carries its content in data', () => {
    const { result } = renderHook(() => useAttachmentAction());
    const attachment = makeAttachment({
      name: 'report.md',
      contentType: 'text/markdown',
      url: undefined,
      data: btoa('# Report'),
    });

    result.current.handleAttachmentClick(attachment);

    expect(anchorClickSpy).toHaveBeenCalledOnce();
    expect(getDownloadAnchor()?.download).toBe('report.md');
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

  describe('downloadAttachment', () => {
    it('triggers an anchor download and returns true for a DIAL file attachment', () => {
      const attachment = makeAttachment({
        url: 'files/my-bucket/folder/file.pdf',
      });

      const result = downloadAttachment(attachment);

      expect(result).toBe(true);
      expect(anchorClickSpy).toHaveBeenCalledOnce();
      expect(getDownloadAnchor()?.href).toContain('/api/v1/files/download');
      expect(getDownloadAnchor()?.download).toBe('file.pdf');
    });

    it('triggers a blob download and returns true for an inline data attachment', () => {
      const attachment = makeAttachment({
        name: 'report.md',
        contentType: 'text/markdown',
        url: undefined,
        data: btoa('# Report'),
      });

      const result = downloadAttachment(attachment);

      expect(result).toBe(true);
      expect(anchorClickSpy).toHaveBeenCalledOnce();
      expect(getDownloadAnchor()?.download).toBe('report.md');
    });

    it('returns false and does not download for a non-DIAL file URL', () => {
      const attachment = makeAttachment({
        url: 'https://external.com/file.pdf',
      });

      const result = downloadAttachment(attachment);

      expect(result).toBe(false);
      expect(anchorClickSpy).not.toHaveBeenCalled();
    });

    it('returns false and does not download for an attachment with no URL', () => {
      const attachment = makeAttachment({ url: undefined });

      const result = downloadAttachment(attachment);

      expect(result).toBe(false);
      expect(anchorClickSpy).not.toHaveBeenCalled();
    });
  });

  describe('isDownloadableAttachment', () => {
    it('accepts DIAL-hosted and inline attachments', () => {
      expect(
        isDownloadableAttachment(
          makeAttachment({ url: 'files/my-bucket/file.pdf' }),
        ),
      ).toBe(true);
      expect(
        isDownloadableAttachment(
          makeAttachment({ url: undefined, data: btoa('# Report') }),
        ),
      ).toBe(true);
    });

    it('rejects reference-only and external attachments', () => {
      expect(
        isDownloadableAttachment(
          makeAttachment({ url: 'https://external.com/file.pdf' }),
        ),
      ).toBe(false);
      expect(
        isDownloadableAttachment(
          makeAttachment({
            url: undefined,
            referenceUrl: 'https://example.com/source',
          }),
        ),
      ).toBe(false);
    });
  });
});
