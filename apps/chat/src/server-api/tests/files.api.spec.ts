import type { ListFilesResponseDto } from '@epam/chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filesApi } from '../api-client';
import { listFiles } from '../files.api';

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
