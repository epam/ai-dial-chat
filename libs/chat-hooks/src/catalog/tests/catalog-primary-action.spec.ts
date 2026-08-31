import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it, vi } from 'vitest';
import {
  CatalogPrimaryActionType,
  resolveCatalogPrimaryAction,
} from '../catalog-primary-action';

const makeItem = (
  id: string,
  type: CatalogEntityType,
  overrides: Partial<CatalogItem> = {},
): CatalogItem =>
  ({
    id,
    type,
    name: `Name of ${id}`,
    version: '',
    lastUsed: '',
    description: `Desc of ${id}`,
    folder: [],
    topics: [],
    ...overrides,
  }) as CatalogItem;

const makePromptDto = (content: string): PromptResponseDto =>
  ({
    id: 'dto-id',
    bucket: 'b',
    name: 'n',
    content,
    folderId: '',
    createdAt: 0,
    updatedAt: 0,
  }) as PromptResponseDto;

describe('resolveCatalogPrimaryAction', () => {
  describe('non-prompt items', () => {
    it('resolves to deployment with the item id for a Model', async () => {
      const item = makeItem('model-1', CatalogEntityType.Model);
      const fetchPrompt = vi.fn();
      const result = await resolveCatalogPrimaryAction(item, fetchPrompt);
      expect(result).toEqual({
        kind: CatalogPrimaryActionType.Deployment,
        id: 'model-1',
      });
      expect(fetchPrompt).not.toHaveBeenCalled();
    });

    it('resolves to deployment for Agent', async () => {
      const item = makeItem('agent-1', CatalogEntityType.Agent);
      const result = await resolveCatalogPrimaryAction(item, vi.fn());
      expect(result.kind).toBe(CatalogPrimaryActionType.Deployment);
    });

    it('resolves to deployment for Toolset', async () => {
      const item = makeItem('ts-1', CatalogEntityType.Toolset);
      const result = await resolveCatalogPrimaryAction(item, vi.fn());
      expect(result.kind).toBe(CatalogPrimaryActionType.Deployment);
    });

    it('resolves to deployment for Skill', async () => {
      const item = makeItem('skill-1', CatalogEntityType.Skill);
      const result = await resolveCatalogPrimaryAction(item, vi.fn());
      expect(result.kind).toBe(CatalogPrimaryActionType.Deployment);
    });
  });

  describe('prompt items — seeded content', () => {
    it('returns prompt result without calling fetcher when content is seeded', async () => {
      const item = makeItem('p-1', CatalogEntityType.Prompt, {
        details: {
          promptContent: { content: 'Hello world' },
        } as CatalogItem['details'],
      });
      const fetchPrompt = vi.fn();
      const result = await resolveCatalogPrimaryAction(item, fetchPrompt);

      expect(fetchPrompt).not.toHaveBeenCalled();
      expect(result.kind).toBe(CatalogPrimaryActionType.Prompt);
      if (result.kind === CatalogPrimaryActionType.Prompt) {
        expect(result.content).toBe('Hello world');
        expect(result.id).toBe('p-1');
        expect(result.hasParameters).toBe(false);
      }
    });

    it('detects parameters in seeded prompt content', async () => {
      const item = makeItem('p-params', CatalogEntityType.Prompt, {
        details: {
          promptContent: { content: 'Hello {{name}}' },
        } as CatalogItem['details'],
      });
      const result = await resolveCatalogPrimaryAction(item, vi.fn());
      expect(result.kind).toBe(CatalogPrimaryActionType.Prompt);
      if (result.kind === CatalogPrimaryActionType.Prompt) {
        expect(result.hasParameters).toBe(true);
      }
    });
  });

  describe('prompt items — fetched content', () => {
    it('calls fetcher when prompt content is not seeded', async () => {
      const item = makeItem('p-2', CatalogEntityType.Prompt);
      const fetchPrompt = vi
        .fn()
        .mockResolvedValue(makePromptDto('Fetched body'));
      const result = await resolveCatalogPrimaryAction(item, fetchPrompt);

      expect(fetchPrompt).toHaveBeenCalledOnce();
      expect(fetchPrompt).toHaveBeenCalledWith(item);
      expect(result.kind).toBe(CatalogPrimaryActionType.Prompt);
      if (result.kind === CatalogPrimaryActionType.Prompt) {
        expect(result.content).toBe('Fetched body');
        expect(result.hasParameters).toBe(false);
      }
    });

    it('detects parameters in fetched prompt content', async () => {
      const item = makeItem('p-3', CatalogEntityType.Prompt);
      const fetchPrompt = vi
        .fn()
        .mockResolvedValue(makePromptDto('Hello {{name}} and {{place}}'));
      const result = await resolveCatalogPrimaryAction(item, fetchPrompt);
      if (result.kind === CatalogPrimaryActionType.Prompt) {
        expect(result.hasParameters).toBe(true);
      }
    });

    it('propagates fetcher rejection to caller', async () => {
      const item = makeItem('p-fail', CatalogEntityType.Prompt);
      const fetchError = new Error('Network error');
      const fetchPrompt = vi.fn().mockRejectedValue(fetchError);
      await expect(
        resolveCatalogPrimaryAction(item, fetchPrompt),
      ).rejects.toThrow(fetchError);
    });

    it('includes item name and description in the result', async () => {
      const item = makeItem('p-meta', CatalogEntityType.Prompt);
      const fetchPrompt = vi
        .fn()
        .mockResolvedValue(makePromptDto('Simple body'));
      const result = await resolveCatalogPrimaryAction(item, fetchPrompt);
      if (result.kind === CatalogPrimaryActionType.Prompt) {
        expect(result.name).toBe('Name of p-meta');
        expect(result.description).toBe('Desc of p-meta');
      }
    });
  });
});
