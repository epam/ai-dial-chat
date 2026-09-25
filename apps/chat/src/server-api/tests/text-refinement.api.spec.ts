import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { textRefinementApi } from '../api-client';
import { refineText } from '../text-refinement.api';

vi.mock('../api-client', () => ({
  textRefinementApi: { refineText: vi.fn() },
}));

describe('Text refinement adapter', () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(Object.values(TextRefinementPurpose))(
    'maps %s and cancellation through the normal generated method',
    async (purpose) => {
      const signal = new AbortController().signal;
      vi.mocked(textRefinementApi.refineText).mockResolvedValue({
        text: ' refined ',
      });
      await expect(refineText(purpose, ' original ', signal)).resolves.toBe(
        ' refined ',
      );
      expect(textRefinementApi.refineText).toHaveBeenCalledWith(
        { refineTextRequestDto: { purpose, text: ' original ' } },
        { signal },
      );
    },
  );
  it('propagates errors to the field lifecycle', async () => {
    const error = new Error('Unavailable');
    vi.mocked(textRefinementApi.refineText).mockRejectedValue(error);
    await expect(
      refineText(
        TextRefinementPurpose.SkillDescription,
        'original',
        new AbortController().signal,
      ),
    ).rejects.toBe(error);
  });
});
