import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttachmentAction } from '../useAttachmentAction';

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

  beforeEach(() => {
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
  });

  afterEach(() => {
    createElementSpy.mockRestore();
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

  it('returns a stable callback reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useAttachmentAction());
    const first = result.current.handleAttachmentClick;
    rerender();
    expect(result.current.handleAttachmentClick).toBe(first);
  });
});
