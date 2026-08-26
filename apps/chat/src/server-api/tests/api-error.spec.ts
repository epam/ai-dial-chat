import { describe, expect, it } from 'vitest';
import { getApiErrorStatus, isConversationNotFoundError } from '../api-error';

/*
 * Full behavioral coverage now lives in `@epam/ai-dial-chat-hooks`'s own
 * `api-error.spec.ts`. This smoke test only confirms the temporary
 * re-export in `apps/chat/src/server-api/api-error.ts` (removed once all
 * 21 consumers migrate to the package import directly) resolves correctly.
 */
describe('api-error re-export', () => {
  it('resolves getApiErrorStatus/isConversationNotFoundError from @epam/ai-dial-chat-hooks', () => {
    const response = { status: 404, json: async () => ({}) };
    const error = { response };

    expect(getApiErrorStatus(error)).toBe(404);
    expect(isConversationNotFoundError(error)).toBe(true);
  });
});
