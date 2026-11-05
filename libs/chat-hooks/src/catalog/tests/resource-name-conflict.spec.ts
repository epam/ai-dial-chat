import { ResourceNameConflictCode } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import {
  ResourceNameConflictKind,
  getResourceNameConflictKind,
  withResourceNameConflictMessages,
} from '../resource-name-conflict';
import {
  ResourceSaveError,
  type ResourceCreateSaveAdapter,
  type ResourceEditSaveAdapter,
} from '../resource-save';

const failure = (status: number, body: Record<string, unknown>) =>
  Object.assign(new Error('failed'), {
    response: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

const messages = {
  [ResourceNameConflictKind.Agent]: 'An agent holds it',
  [ResourceNameConflictKind.Toolset]: 'A toolset holds it',
};

const editAdapter = (
  overrides: Partial<ResourceEditSaveAdapter> = {},
): ResourceEditSaveAdapter => ({
  publishEntityType: 'application',
  isVersioned: true,
  saveInPlace: vi.fn(),
  saveAsNewVersion: vi.fn(),
  move: vi.fn(),
  ...overrides,
});

describe('getResourceNameConflictKind', () => {
  it('maps the agent duplicate code to the agent kind', async () => {
    await expect(
      getResourceNameConflictKind(
        failure(409, { code: ResourceNameConflictCode.NameTakenAgent }),
      ),
    ).resolves.toBe(ResourceNameConflictKind.Agent);
  });

  it('maps the toolset duplicate code to the toolset kind', async () => {
    await expect(
      getResourceNameConflictKind(
        failure(409, { code: ResourceNameConflictCode.NameTakenToolset }),
      ),
    ).resolves.toBe(ResourceNameConflictKind.Toolset);
  });

  it('ignores a 409 without a code', async () => {
    await expect(
      getResourceNameConflictKind(failure(409, { message: 'taken' })),
    ).resolves.toBeUndefined();
  });

  it('ignores an unknown code', async () => {
    await expect(
      getResourceNameConflictKind(failure(409, { code: 'name-taken' })),
    ).resolves.toBeUndefined();
  });

  it('ignores a duplicate code on another status', async () => {
    await expect(
      getResourceNameConflictKind(
        failure(400, { code: ResourceNameConflictCode.NameTakenAgent }),
      ),
    ).resolves.toBeUndefined();
  });

  it('ignores an error that carries no response', async () => {
    await expect(
      getResourceNameConflictKind(new Error('offline')),
    ).resolves.toBeUndefined();
  });
});

describe('withResourceNameConflictMessages', () => {
  it('turns an agent duplicate on a new version into a ResourceSaveError with the agent message', async () => {
    const adapter = withResourceNameConflictMessages(
      editAdapter({
        saveAsNewVersion: vi
          .fn()
          .mockRejectedValue(
            failure(409, { code: ResourceNameConflictCode.NameTakenAgent }),
          ),
      }),
      messages,
    ) as ResourceEditSaveAdapter;

    const error = await adapter
      .saveAsNewVersion?.('1.1.0', [])
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ResourceSaveError);
    expect((error as Error).message).toBe('An agent holds it');
  });

  it('names a toolset for an in-place save that collides with a toolset', async () => {
    const adapter = withResourceNameConflictMessages(
      editAdapter({
        saveInPlace: vi
          .fn()
          .mockRejectedValue(
            failure(409, { code: ResourceNameConflictCode.NameTakenToolset }),
          ),
      }),
      messages,
    ) as ResourceEditSaveAdapter;

    const error = await adapter.saveInPlace().catch((e: unknown) => e);

    expect((error as Error).message).toBe('A toolset holds it');
  });

  it('wraps the create step of a create adapter', async () => {
    const createAdapter: ResourceCreateSaveAdapter = {
      publishEntityType: 'application',
      isVersioned: false,
      createIn: vi
        .fn()
        .mockRejectedValue(
          failure(409, { code: ResourceNameConflictCode.NameTakenAgent }),
        ),
    };

    const adapter = withResourceNameConflictMessages(
      createAdapter,
      messages,
    ) as ResourceCreateSaveAdapter;
    const error = await adapter.createIn([]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ResourceSaveError);
  });

  it('passes a 409 without a duplicate code through unchanged', async () => {
    const original = failure(409, { message: 'taken' });
    const adapter = withResourceNameConflictMessages(
      editAdapter({ saveAsNewVersion: vi.fn().mockRejectedValue(original) }),
      messages,
    ) as ResourceEditSaveAdapter;

    await expect(adapter.saveAsNewVersion?.('1.1.0', [])).rejects.toBe(
      original,
    );
  });

  it('leaves the move step untouched', () => {
    const base = editAdapter();
    const adapter = withResourceNameConflictMessages(
      base,
      messages,
    ) as ResourceEditSaveAdapter;

    expect(adapter.move).toBe(base.move);
  });

  it('returns results of successful steps unchanged', async () => {
    const adapter = withResourceNameConflictMessages(
      editAdapter({ saveInPlace: vi.fn().mockResolvedValue({ id: 'x' }) }),
      messages,
    ) as ResourceEditSaveAdapter;

    await expect(adapter.saveInPlace()).resolves.toEqual({ id: 'x' });
  });
});
