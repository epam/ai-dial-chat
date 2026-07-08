import type { Attachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadFile } from '../../../server-api/files.api';
import { useAttachmentUpload } from '../useAttachmentUpload';

vi.mock('../../../server-api/files.api', () => ({
  uploadFile: vi.fn(),
}));
vi.mock('../../../utils/build-upload-path', () => ({
  buildUploadPath: vi.fn(
    (attachment: { name: string }) => `uploads/${attachment.name}`,
  ),
}));

const mockUploadFile = vi.mocked(uploadFile);

const makeAttachment = (name = 'file.pdf'): Attachment => ({
  id: 'att-1',
  name,
  contentType: 'application/pdf',
  file: new File(['content'], name, { type: 'application/pdf' }),
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url: 'https://example.com/file.pdf',
});

describe('useAttachmentUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uploads a file via the files API while online', async () => {
    mockUploadFile.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    const { result } = renderHook(() =>
      useAttachmentUpload({ bucket: 'user-bucket' }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment()),
    ).resolves.toBe('https://example.com/file.pdf');

    expect(mockUploadFile).toHaveBeenCalledWith(
      'user-bucket',
      'uploads/file.pdf',
      expect.any(File),
    );
  });

  it('batches offline failures and notifies once after the debounce window', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    mockUploadFile.mockRejectedValue(new Error('network down'));
    const onNetworkError = vi.fn();
    const { result } = renderHook(() =>
      useAttachmentUpload({ bucket: 'user-bucket', onNetworkError }),
    );

    const first = result.current.handleUploadAttachment(
      makeAttachment('a.pdf'),
    );
    const second = result.current.handleUploadAttachment(
      makeAttachment('b.pdf'),
    );

    await Promise.allSettled([first, second]);
    await act(async () => {
      vi.runAllTimers();
    });

    expect(onNetworkError).toHaveBeenCalledOnce();
    expect(onNetworkError).toHaveBeenCalledWith(['a.pdf', 'b.pdf']);
    await expect(first).rejects.toMatchObject({
      errorReason: AttachmentErrorReason.Network,
    });

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  it('does not throw when no onNetworkError callback is provided', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    mockUploadFile.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() =>
      useAttachmentUpload({ bucket: 'user-bucket' }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment()),
    ).rejects.toMatchObject({ errorReason: AttachmentErrorReason.Network });

    expect(() => vi.runAllTimers()).not.toThrow();

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });
});
