import type { CatalogItem } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCatalogItemDelete } from '../useCatalogItemDelete';

const makeParams = () => ({
  deletePrompt: vi.fn(async () => undefined),
  deleteToolset: vi.fn(async () => undefined),
  deleteSkill: vi.fn(async () => undefined),
  deleteApplication: vi.fn(async () => undefined),
  refetchPrompts: vi.fn(async () => undefined),
  refetchToolsets: vi.fn(async () => undefined),
  refetchSkills: vi.fn(async () => undefined),
  refetchDeployments: vi.fn(async () => undefined),
  onDeleteSuccess: vi.fn(),
  deleteErrorLabel: 'Could not delete',
  onNotify: vi.fn(),
});

const item = (type: CatalogEntityType, id: string) =>
  ({ id, type, name: id }) as CatalogItem;

describe('useCatalogItemDelete', () => {
  it('deletes a prompt through its endpoint and refetches prompts', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useCatalogItemDelete(params));
    const prompt = item(CatalogEntityType.Prompt, 'prompts/b/p');

    await result.current(prompt);

    expect(params.deletePrompt).toHaveBeenCalledWith('prompts/b/p');
    expect(params.refetchPrompts).toHaveBeenCalledOnce();
    expect(params.onDeleteSuccess).toHaveBeenCalledWith(prompt);
  });

  it('deletes a skill by its parsed bucket and path', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useCatalogItemDelete(params));

    await result.current(
      item(CatalogEntityType.Skill, 'skills/bucket/my-skill'),
    );

    expect(params.deleteSkill).toHaveBeenCalledWith('bucket', 'my-skill');
    expect(params.refetchSkills).toHaveBeenCalledOnce();
  });

  it('deletes any other item as an application', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useCatalogItemDelete(params));

    await result.current(item(CatalogEntityType.Agent, 'applications/b/a'));

    expect(params.deleteApplication).toHaveBeenCalledWith('applications/b/a');
    expect(params.refetchDeployments).toHaveBeenCalledOnce();
  });

  it('notifies and rethrows when the delete fails', async () => {
    const params = makeParams();
    const failure = new Error('boom');
    params.deleteToolset.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useCatalogItemDelete(params));

    await expect(
      result.current(item(CatalogEntityType.Toolset, 'toolsets/b/t')),
    ).rejects.toBe(failure);

    expect(params.onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Could not delete' }),
    );
    expect(params.onDeleteSuccess).not.toHaveBeenCalled();
  });
});
