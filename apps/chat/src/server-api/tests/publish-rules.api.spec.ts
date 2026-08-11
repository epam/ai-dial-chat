import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishApi } from '../api-client';
import { getPublishRules } from '../publish-rules.api';

vi.mock('../api-client', () => ({
  publishApi: {
    getPublishRules: vi.fn(),
  },
}));

describe('publish-rules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards folderPath and returns the rules array from the response', async () => {
    const rawRules = [
      { source: 'role', _function: 'CONTAIN', targets: ['engineering'] },
    ];
    vi.mocked(publishApi.getPublishRules).mockResolvedValue({
      rules: rawRules,
    } as never);

    const result = await getPublishRules('Organization/Data Science');

    expect(publishApi.getPublishRules).toHaveBeenCalledWith({
      folderPath: 'Organization/Data Science',
    });
    expect(result).toEqual([
      { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
    ]);
  });

  it('does not leak the raw _function key onto the returned rule', async () => {
    vi.mocked(publishApi.getPublishRules).mockResolvedValue({
      rules: [
        { source: 'role', _function: 'CONTAIN', targets: ['engineering'] },
      ],
    } as never);

    const result = await getPublishRules('Organization/Data Science');

    expect(result[0]).not.toHaveProperty('_function');
  });

  it('returns an empty array when the folder has no rules', async () => {
    vi.mocked(publishApi.getPublishRules).mockResolvedValue({
      rules: [],
    } as never);

    const result = await getPublishRules('Organization/Empty Folder');

    expect(result).toEqual([]);
  });
});
