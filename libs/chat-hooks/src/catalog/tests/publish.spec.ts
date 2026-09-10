import type { PublishHistoryEntryDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getPublicCatalogEntityFolderPath,
  isPublicCatalogEntityId,
  mapPublishHistoryEntryDto,
  toPublishEntityType,
} from '../publish';

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

describe('isPublicCatalogEntityId', () => {
  it.each([
    'applications/public/Data Science/Revenue bot',
    'toolsets/public/Jira',
    'prompts/public/Marketing/Tagline',
  ])('treats %s as a published copy', (id) => {
    expect(isPublicCatalogEntityId(id)).toBe(true);
  });

  it('treats an id in the caller’s own bucket as not public', () => {
    expect(isPublicCatalogEntityId('applications/my-bucket/Revenue bot')).toBe(
      false,
    );
  });

  /* The bucket is the second segment, so a personal folder named `public`
   * must not read as the shared public area. */
  it('does not match a personal folder that happens to be named public', () => {
    expect(
      isPublicCatalogEntityId('applications/my-bucket/public/Revenue bot'),
    ).toBe(false);
  });

  it('treats a bare deployment id with no bucket as not public', () => {
    expect(isPublicCatalogEntityId('gpt-4')).toBe(false);
  });
});

describe('getPublicCatalogEntityFolderPath', () => {
  it('returns the segments between the public bucket and the entity name', () => {
    expect(
      getPublicCatalogEntityFolderPath(
        'applications/public/Organization/Data Science/Revenue bot',
      ),
    ).toEqual(['Organization', 'Data Science']);
  });

  it('decodes percent-encoded segments to the plain text the publish API takes', () => {
    expect(
      getPublicCatalogEntityFolderPath(
        'applications/public/Data%20Science/Revenue%20bot',
      ),
    ).toEqual(['Data Science']);
  });

  it('returns an empty path for a copy published at the public root', () => {
    expect(
      getPublicCatalogEntityFolderPath('applications/public/Revenue bot'),
    ).toEqual([]);
  });

  it('returns an empty path for an id that is not public', () => {
    expect(
      getPublicCatalogEntityFolderPath(
        'applications/my-bucket/Data Science/Revenue bot',
      ),
    ).toEqual([]);
  });
});
