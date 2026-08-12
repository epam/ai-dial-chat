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
    /* The wire (and the generated DTO) name the discriminator `function`. */
    const rawRules = [
      { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
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

  it('returns exactly source, function, and targets on each rule', async () => {
    vi.mocked(publishApi.getPublishRules).mockResolvedValue({
      rules: [
        { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
      ],
    } as never);

    const result = await getPublishRules('Organization/Data Science');

    expect(Object.keys(result[0])).toEqual(['source', 'targets', 'function']);
  });

  it('returns an empty array when the folder has no rules', async () => {
    vi.mocked(publishApi.getPublishRules).mockResolvedValue({
      rules: [],
    } as never);

    const result = await getPublishRules('Organization/Empty Folder');

    expect(result).toEqual([]);
  });
});
