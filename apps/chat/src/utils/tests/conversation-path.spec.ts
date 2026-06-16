import { describe, expect, it } from 'vitest';
import { getConversationPath } from '../conversation-path';

describe('getConversationPath', () => {
  it('strips the bucket without decoding resource path segments', () => {
    expect(
      getConversationPath(
        'bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
      ),
    ).toBe('applications/catalog/Team%2FApp%20One__0.0.1__title');
  });

  it('keeps a path without a bucket unchanged', () => {
    expect(getConversationPath('conversation__title')).toBe(
      'conversation__title',
    );
  });
});
