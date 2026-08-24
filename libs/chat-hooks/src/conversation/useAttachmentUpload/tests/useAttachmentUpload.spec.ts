import type { FilesApi } from '@epam/ai-dial-chat-api-client';
import type { Attachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttachmentUpload } from '../useAttachmentUpload';

const uploadFile = vi.fn();
const fakeFilesApi = { uploadFile } as unknown as Pick<FilesApi, 'uploadFile'>;

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
    uploadFile.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment()),
    ).resolves.toBe('https://example.com/file.pdf');

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'user-bucket',
        file: expect.any(File),
      }),
    );
  });

  it('rejects when no bucket is available', async () => {
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: undefined }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment()),
    ).rejects.toThrow('User bucket is not available');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('batches offline failures and notifies once after the debounce window', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    uploadFile.mockRejectedValue(new Error('network down'));
    const onNetworkError = vi.fn();
    const { result } = renderHook(() =>
      useAttachmentUpload({
        filesApi: fakeFilesApi,
        bucket: 'user-bucket',
        onNetworkError,
      }),
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
    uploadFile.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
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
