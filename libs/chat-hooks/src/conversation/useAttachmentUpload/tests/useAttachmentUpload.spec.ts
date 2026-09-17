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
    ).resolves.toEqual({
      url: 'https://example.com/file.pdf',
      name: 'file.pdf',
    });

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'user-bucket',
        file: expect.any(File),
      }),
    );
  });

  it('sanitizes forbidden path characters in the file name before upload', async () => {
    uploadFile.mockResolvedValue({ url: 'https://example.com/file.csv' });
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
    );

    await result.current.handleUploadAttachment(
      makeAttachment('people&500000.csv'),
    );

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining('people_500000.csv'),
      }),
    );
  });

  it('uploads in create-only mode so an existing file is never replaced', async () => {
    uploadFile.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
    );

    await result.current.handleUploadAttachment(makeAttachment());

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ uploadMode: 'create-only' }),
    );
  });

  it('gives two same-named attachments distinct upload paths', async () => {
    uploadFile.mockResolvedValue({ url: 'https://example.com/file.png' });
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
    );

    const first = await result.current.handleUploadAttachment(
      makeAttachment('Screenshot.png'),
    );
    const second = await result.current.handleUploadAttachment(
      makeAttachment('Screenshot.png'),
    );

    expect(first.name).toBe('Screenshot.png');
    expect(second.name).toBe('Screenshot (1).png');
    expect(uploadFile.mock.calls[0][0].path).not.toBe(
      uploadFile.mock.calls[1][0].path,
    );
  });

  it('retries on the next free name when the server reports a conflict', async () => {
    uploadFile
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValue({ url: 'https://example.com/file.png' });
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment('Screenshot.png')),
    ).resolves.toEqual({
      url: 'https://example.com/file.png',
      name: 'Screenshot (1).png',
    });
    expect(uploadFile).toHaveBeenCalledTimes(2);
  });

  it('gives up and rethrows once the conflict retry limit is exhausted', async () => {
    uploadFile.mockRejectedValue({ response: { status: 409 } });
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment('Screenshot.png')),
    ).rejects.toMatchObject({ response: { status: 409 } });
    expect(uploadFile).toHaveBeenCalledTimes(6);
  });

  it('skips all stored names after remounting and can attach the file again', async () => {
    const storedNames = new Set([
      'Screenshot.png',
      ...Array.from({ length: 12 }, (_, i) => `Screenshot (${i + 1}).png`),
    ]);
    const listFiles = vi.fn().mockImplementation(async () => ({
      items: [...storedNames].map((name) => ({ name })),
    }));
    uploadFile.mockImplementation(async ({ path, file }) => {
      if (storedNames.has(file.name)) {
        throw { response: { status: 409 } };
      }
      storedNames.add(file.name);
      return { url: `files/user-bucket/${path}` };
    });
    const renderUploader = () =>
      renderHook(() =>
        useAttachmentUpload({
          filesApi: { ...fakeFilesApi, listFiles },
          bucket: 'user-bucket',
        }),
      );
    const { result: firstResult, unmount } = renderUploader();

    await expect(
      firstResult.current.handleUploadAttachment(
        makeAttachment('Screenshot.png'),
      ),
    ).resolves.toMatchObject({ name: 'Screenshot (13).png' });
    unmount();

    const { result: nextResult } = renderUploader();
    await expect(
      nextResult.current.handleUploadAttachment(
        makeAttachment('Screenshot.png'),
      ),
    ).resolves.toMatchObject({ name: 'Screenshot (14).png' });
    await expect(
      nextResult.current.handleUploadAttachment(
        makeAttachment('Screenshot.png'),
      ),
    ).resolves.toMatchObject({ name: 'Screenshot (15).png' });
    expect(uploadFile).toHaveBeenCalledTimes(5);
    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(listFiles).toHaveBeenCalledWith({
      bucket: 'user-bucket',
      path: expect.stringMatching(/^uploads\/\d{4}-\d{2}$/),
    });
    expect(storedNames.size).toBe(16);
    for (const [request] of uploadFile.mock.calls) {
      expect(request.uploadMode).toBe('create-only');
    }
  });

  it('does not list files when the initial upload succeeds', async () => {
    uploadFile.mockResolvedValue({ url: 'files/user-bucket/file.pdf' });
    const listFiles = vi.fn();
    const { result } = renderHook(() =>
      useAttachmentUpload({
        filesApi: { ...fakeFilesApi, listFiles },
        bucket: 'user-bucket',
      }),
    );

    await result.current.handleUploadAttachment(makeAttachment());

    expect(listFiles).not.toHaveBeenCalled();
  });

  it('preserves distinct reservations for concurrent uploads after listing', async () => {
    const storedNames = new Set(['file.pdf', 'file (1).pdf']);
    const listFiles = vi.fn().mockResolvedValue({
      items: [...storedNames].map((name) => ({ name })),
    });
    uploadFile.mockImplementation(async ({ path, file }) => {
      if (storedNames.has(file.name)) {
        throw { response: { status: 409 } };
      }
      storedNames.add(file.name);
      return { url: `files/user-bucket/${path}` };
    });
    const { result } = renderHook(() =>
      useAttachmentUpload({
        filesApi: { ...fakeFilesApi, listFiles },
        bucket: 'user-bucket',
      }),
    );

    const uploaded = await Promise.all([
      result.current.handleUploadAttachment(makeAttachment()),
      result.current.handleUploadAttachment(makeAttachment()),
    ]);

    expect(uploaded.map(({ name }) => name)).toEqual([
      'file (2).pdf',
      'file (3).pdf',
    ]);
    expect(uploaded[0].url).not.toBe(uploaded[1].url);
    expect(storedNames.size).toBe(4);
  });

  it('bounds retries even when the listing is stale and conflicts persist', async () => {
    uploadFile.mockRejectedValue({ response: { status: 409 } });
    const listFiles = vi.fn().mockResolvedValue({ items: [] });
    const { result } = renderHook(() =>
      useAttachmentUpload({
        filesApi: { ...fakeFilesApi, listFiles },
        bucket: 'user-bucket',
      }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment()),
    ).rejects.toMatchObject({ response: { status: 409 } });
    expect(uploadFile).toHaveBeenCalledTimes(6);
    expect(listFiles).toHaveBeenCalledTimes(5);
  });

  it('keeps retrying with a suffix if listing the folder fails', async () => {
    uploadFile
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValue({ url: 'files/user-bucket/file.pdf' });
    const listFiles = vi.fn().mockRejectedValue(new Error('listing failed'));
    const { result } = renderHook(() =>
      useAttachmentUpload({
        filesApi: { ...fakeFilesApi, listFiles },
        bucket: 'user-bucket',
      }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment()),
    ).resolves.toMatchObject({ name: 'file (1).pdf' });
    expect(listFiles).toHaveBeenCalledOnce();
    expect(uploadFile).toHaveBeenCalledTimes(2);
  });

  it('reuses the name of a failed upload for the next attempt', async () => {
    uploadFile.mockRejectedValueOnce(new Error('server error'));
    const { result } = renderHook(() =>
      useAttachmentUpload({ filesApi: fakeFilesApi, bucket: 'user-bucket' }),
    );

    await expect(
      result.current.handleUploadAttachment(makeAttachment('Screenshot.png')),
    ).rejects.toThrow('server error');

    uploadFile.mockResolvedValue({ url: 'https://example.com/file.png' });
    await expect(
      result.current.handleUploadAttachment(makeAttachment('Screenshot.png')),
    ).resolves.toMatchObject({ name: 'Screenshot.png' });
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
