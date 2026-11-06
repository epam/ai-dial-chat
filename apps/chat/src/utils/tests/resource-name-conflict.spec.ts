import { ResourceNameConflictCode } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import { getResourceNameConflictKey } from '../resource-name-conflict';

const failure = (status: number, body: Record<string, unknown>) =>
  Object.assign(new Error('failed'), {
    response: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

describe('getResourceNameConflictKey', () => {
  it('maps the agent duplicate code to the agent message key', async () => {
    await expect(
      getResourceNameConflictKey(
        failure(409, { code: ResourceNameConflictCode.NameTakenAgent }),
      ),
    ).resolves.toBe(AppsEditorI18nKeys.ErrorNameConflictAgent);
  });

  it('maps the toolset duplicate code to the toolset message key', async () => {
    await expect(
      getResourceNameConflictKey(
        failure(409, { code: ResourceNameConflictCode.NameTakenToolset }),
      ),
    ).resolves.toBe(AppsEditorI18nKeys.ErrorNameConflictToolset);
  });

  it('ignores a 409 without a code', async () => {
    await expect(
      getResourceNameConflictKey(failure(409, { message: 'taken' })),
    ).resolves.toBeUndefined();
  });

  it('ignores an unknown code', async () => {
    await expect(
      getResourceNameConflictKey(failure(409, { code: 'name-taken' })),
    ).resolves.toBeUndefined();
  });

  it('ignores a duplicate code on another status', async () => {
    await expect(
      getResourceNameConflictKey(
        failure(400, { code: ResourceNameConflictCode.NameTakenAgent }),
      ),
    ).resolves.toBeUndefined();
  });

  it('ignores an error that carries no response', async () => {
    await expect(
      getResourceNameConflictKey(new Error('offline')),
    ).resolves.toBeUndefined();
  });
});
