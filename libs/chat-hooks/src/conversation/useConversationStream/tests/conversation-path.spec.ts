import { describe, expect, it } from 'vitest';
import { getConversationPath } from '../conversation-path';

describe('getConversationPath', () => {
  it.each([
    [
      'strips the bucket',
      {
        id: 'bucket/applications/catalog/App One__0.0.1__title',
        expected: 'applications/catalog/App One__0.0.1__title',
      },
    ],
    [
      'keeps a path without a bucket unchanged',
      { id: 'conversation__title', expected: 'conversation__title' },
    ],
    /*
     * The backend concatenates whatever `deploymentId` it received (which may
     * already be percent-encoded, e.g. for an app name containing a space)
     * directly into the conversation id, alongside otherwise-raw segments
     * (message-derived name, uuid). Every caller of getConversationPath passes
     * its result to an API client that percent-encodes the whole value exactly
     * once — so an already-encoded fragment must be decoded back to raw first,
     * or it gets double-encoded on the wire and DIAL Core rejects the request.
     */
    [
      'decodes an already-percent-encoded segment back to raw so it is not double-encoded downstream',
      {
        id: 'bucket/applications/catalog/NT%20test%2021%207__0.0.1__Can you suggest best budget hotel in Paris?__uuid',
        expected:
          'applications/catalog/NT test 21 7__0.0.1__Can you suggest best budget hotel in Paris?__uuid',
      },
    ],
    [
      'leaves a literal, non-percent-encoding "%" in message text unchanged when decoding fails',
      { id: 'bucket/gpt-4o__50% off__uuid', expected: 'gpt-4o__50% off__uuid' },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(getConversationPath(id)).toBe(expected);
  });
});
