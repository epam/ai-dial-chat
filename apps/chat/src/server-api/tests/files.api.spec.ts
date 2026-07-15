import type {
  FileMetadataResponseDto,
  ListFilesResponseDto,
} from '@epam/chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filesApi } from '../api-client';
import { downloadFile, getFileMetadata, listFiles } from '../files.api';

const MOCK_RESPONSE: ListFilesResponseDto = {
  bucket: 'my-bucket',
  path: '',
  items: [],
};

describe('listFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated FilesApi with correct params', async () => {
    const spy = vi
      .spyOn(filesApi, 'listFiles')
      .mockResolvedValue(MOCK_RESPONSE);

    const result = await listFiles({ bucket: 'my-bucket' });

    expect(spy).toHaveBeenCalledWith({ bucket: 'my-bucket' });
    expect(result).toEqual(MOCK_RESPONSE);
  });

  it('passes optional params through to the generated client', async () => {
    const spy = vi
      .spyOn(filesApi, 'listFiles')
      .mockResolvedValue(MOCK_RESPONSE);

    await listFiles({
      bucket: 'my-bucket',
      path: 'folder/',
      limit: 10,
      recursive: false,
      permissions: true,
    });

    expect(spy).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      path: 'folder/',
      limit: 10,
      recursive: false,
      permissions: true,
    });
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 401 });
    vi.spyOn(filesApi, 'listFiles').mockRejectedValue(error);

    await expect(listFiles({ bucket: 'my-bucket' })).rejects.toBe(error);
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

describe('getFileMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated FilesApi with correct params', async () => {
    const spy = vi
      .spyOn(filesApi, 'getFileMetadata')
      .mockResolvedValue(MOCK_METADATA);

    const result = await getFileMetadata({
      bucket: 'my-bucket',
      path: 'reports/file.pdf',
    });

    expect(spy).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      path: 'reports/file.pdf',
    });
    expect(result).toEqual(MOCK_METADATA);
  });

  it('returns the resolved FileMetadataResponseDto', async () => {
    vi.spyOn(filesApi, 'getFileMetadata').mockResolvedValue(MOCK_METADATA);

    const result = await getFileMetadata({
      bucket: 'my-bucket',
      path: 'folder/file.txt',
    });

    expect(result.name).toBe('file.pdf');
    expect(result.etag).toBe('"abc123"');
  });

  it('propagates rejection from the generated client', async () => {
    const error = new Response(null, { status: 404 });
    vi.spyOn(filesApi, 'getFileMetadata').mockRejectedValue(error);

    await expect(
      getFileMetadata({ bucket: 'my-bucket', path: 'missing.pdf' }),
    ).rejects.toBe(error);
  });
});

describe('downloadFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to downloadFileRaw and returns the raw Response', async () => {
    const rawResponse = new Response(new Blob(['bytes']));
    vi.spyOn(filesApi, 'downloadFileRaw').mockResolvedValue({
      raw: rawResponse,
    } as never);

    const result = await downloadFile('my-bucket', 'reports/file.pdf');

    expect(filesApi.downloadFileRaw).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      path: 'reports/file.pdf',
    });
    expect(result).toBe(rawResponse);
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const rawResponse = new Response(new Blob(['bytes']));
    vi.spyOn(filesApi, 'downloadFileRaw').mockResolvedValue({
      raw: rawResponse,
    } as never);
    const controller = new AbortController();

    await downloadFile('my-bucket', 'reports/file.pdf', controller.signal);

    expect(filesApi.downloadFileRaw).toHaveBeenCalledWith(
      { bucket: 'my-bucket', path: 'reports/file.pdf' },
      { signal: controller.signal },
    );
  });
});
