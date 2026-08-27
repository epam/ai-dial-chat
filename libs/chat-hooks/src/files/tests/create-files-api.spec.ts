import type {
  FileMetadataResponseDto,
  FilesApi,
  ListFilesResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import { createFilesApiClient } from '../create-files-api';

const MOCK_RESPONSE: ListFilesResponseDto = {
  bucket: 'my-bucket',
  path: '',
  items: [],
};

const failingUploadFileWithProgress = vi.fn(() => {
  throw new Error('uploadFileWithProgress should not be called in this test');
});

const makeFilesApi = (): FilesApi => ({}) as FilesApi;

describe('createFilesApiClient — listFiles', () => {
  it('delegates to the generated FilesApi with correct params', async () => {
    const filesApi = makeFilesApi();
    const listFilesSpy = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    filesApi.listFiles = listFilesSpy;
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );

    const result = await client.listFiles({ bucket: 'my-bucket' });

    expect(listFilesSpy).toHaveBeenCalledWith(
      { bucket: 'my-bucket' },
      undefined,
    );
    expect(result).toEqual(MOCK_RESPONSE);
  });

  it('passes optional params through to the generated client', async () => {
    const filesApi = makeFilesApi();
    const listFilesSpy = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    filesApi.listFiles = listFilesSpy;
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );

    await client.listFiles({
      bucket: 'my-bucket',
      path: 'folder/',
      limit: 10,
      recursive: false,
      permissions: true,
    });

    expect(listFilesSpy).toHaveBeenCalledWith(
      {
        bucket: 'my-bucket',
        path: 'folder/',
        limit: 10,
        recursive: false,
        permissions: true,
      },
      undefined,
    );
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const filesApi = makeFilesApi();
    const listFilesSpy = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    filesApi.listFiles = listFilesSpy;
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );
    const controller = new AbortController();

    await client.listFiles({ bucket: 'my-bucket' }, controller.signal);

    expect(listFilesSpy).toHaveBeenCalledWith(
      { bucket: 'my-bucket' },
      { signal: controller.signal },
    );
  });

  it('propagates rejection from the generated client', async () => {
    const filesApi = makeFilesApi();
    const error = new Response(null, { status: 401 });
    filesApi.listFiles = vi.fn().mockRejectedValue(error);
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );

    await expect(client.listFiles({ bucket: 'my-bucket' })).rejects.toBe(error);
  });
});

const MOCK_METADATA: FileMetadataResponseDto = {
  name: 'file.pdf',
  nodeType: 'item',
  bucket: 'my-bucket',
  etag: '"abc123"',
  contentLength: 204800,
  contentType: 'application/pdf',
};

describe('createFilesApiClient — getFileMetadata', () => {
  it('delegates to the generated FilesApi with correct params', async () => {
    const filesApi = makeFilesApi();
    const getFileMetadataSpy = vi.fn().mockResolvedValue(MOCK_METADATA);
    filesApi.getFileMetadata = getFileMetadataSpy;
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );

    const result = await client.getFileMetadata({
      bucket: 'my-bucket',
      path: 'reports/file.pdf',
    });

    expect(getFileMetadataSpy).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      path: 'reports/file.pdf',
    });
    expect(result).toEqual(MOCK_METADATA);
  });

  it('propagates rejection from the generated client', async () => {
    const filesApi = makeFilesApi();
    const error = new Response(null, { status: 404 });
    filesApi.getFileMetadata = vi.fn().mockRejectedValue(error);
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );

    await expect(
      client.getFileMetadata({ bucket: 'my-bucket', path: 'missing.pdf' }),
    ).rejects.toBe(error);
  });
});

describe('createFilesApiClient — downloadFile', () => {
  it('delegates to downloadFileRaw and returns the raw Response', async () => {
    const filesApi = makeFilesApi();
    const rawResponse = new Response(new Blob(['bytes']));
    const downloadFileRawSpy = vi.fn().mockResolvedValue({ raw: rawResponse });
    filesApi.downloadFileRaw = downloadFileRawSpy;
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );

    const result = await client.downloadFile('my-bucket', 'reports/file.pdf');

    expect(downloadFileRawSpy).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      path: 'reports/file.pdf',
    });
    expect(result).toBe(rawResponse);
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const filesApi = makeFilesApi();
    const rawResponse = new Response(new Blob(['bytes']));
    const downloadFileRawSpy = vi.fn().mockResolvedValue({ raw: rawResponse });
    filesApi.downloadFileRaw = downloadFileRawSpy;
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );
    const controller = new AbortController();

    await client.downloadFile(
      'my-bucket',
      'reports/file.pdf',
      controller.signal,
    );

    expect(downloadFileRawSpy).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'reports/file.pdf' },
      { signal: controller.signal },
    );
  });
});

describe('createFilesApiClient — uploadFile', () => {
  it('delegates to the generated client when onProgress is not requested', async () => {
    const filesApi = makeFilesApi();
    const uploadFileSpy = vi.fn().mockResolvedValue({ etag: '"abc"' });
    filesApi.uploadFile = uploadFileSpy;
    const client = createFilesApiClient(
      filesApi,
      failingUploadFileWithProgress,
    );
    const file = new File(['bytes'], 'file.txt');

    await client.uploadFile('my-bucket', 'file.txt', file);

    expect(uploadFileSpy).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'file.txt', file, uploadMode: undefined },
      undefined,
    );
  });

  it('delegates to the injected upload function when onProgress is requested', async () => {
    const filesApi = makeFilesApi();
    filesApi.uploadFile = vi.fn();
    const uploadFileWithProgress = vi.fn().mockResolvedValue({
      etag: '"abc"',
    });
    const client = createFilesApiClient(filesApi, uploadFileWithProgress);
    const file = new File(['bytes'], 'file.txt');
    const onProgress = vi.fn();

    await client.uploadFile('my-bucket', 'file.txt', file, { onProgress });

    expect(uploadFileWithProgress).toHaveBeenCalledWith(
      'my-bucket',
      'file.txt',
      file,
      { signal: undefined, onProgress, uploadMode: undefined },
    );
    expect(filesApi.uploadFile).not.toHaveBeenCalled();
  });
});
