import type { PublishHistoryEntryDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { mapPublishHistoryEntryDto, toPublishEntityType } from '../publish';

describe('toPublishEntityType', () => {
  it('maps Model to the publish API model entity type', () => {
    expect(toPublishEntityType(CatalogEntityType.Model)).toBe('model');
  });

  it('maps Toolset to the publish API toolset entity type', () => {
    expect(toPublishEntityType(CatalogEntityType.Toolset)).toBe('toolset');
  });

  it('maps Application to the publish API application entity type', () => {
    expect(toPublishEntityType(CatalogEntityType.Agent)).toBe('application');
  });

  it('maps Prompt to the publish API prompt entity type', () => {
    expect(toPublishEntityType(CatalogEntityType.Prompt)).toBe('prompt');
  });

  it('maps Skill to the publish API skill entity type', () => {
    expect(toPublishEntityType(CatalogEntityType.Skill)).toBe('skill');
  });
});

describe('mapPublishHistoryEntryDto', () => {
  it('maps a DTO to the lib PublishHistoryEntry shape', () => {
    const dto: PublishHistoryEntryDto = {
      entityId: 'tool-abc123',
      entityType: 'toolset',
      folderPath: 'Organization/Data Science/Published models',
      version: '1.2.0',
      publishedAt: '2026-07-13T10:00:00.000Z',
      publishedBy: 'user@example.com',
    };

    expect(mapPublishHistoryEntryDto(dto)).toEqual({
      version: '1.2.0',
      publishedAt: Date.parse('2026-07-13T10:00:00.000Z'),
      folderPath: ['Organization', 'Data Science', 'Published models'],
    });
  });

  it('splits a single-segment folderPath into a one-element array', () => {
    const dto: PublishHistoryEntryDto = {
      entityId: 'tool-abc123',
      entityType: 'toolset',
      folderPath: 'Organization',
      version: '1.0.0',
      publishedAt: '2026-01-01T00:00:00.000Z',
      publishedBy: 'user@example.com',
    };

    expect(mapPublishHistoryEntryDto(dto).folderPath).toEqual(['Organization']);
  });
});
