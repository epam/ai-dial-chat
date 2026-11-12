import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { PublishDependencyType } from '@epam/ai-dial-publish-panel';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  BasicI18nKeys,
  PublishI18nKeys,
} from '../../constants/translation-keys';
import {
  getPublishDependenciesEntityKey,
  getPublishDependenciesLabels,
  getPublishFolderLabel,
} from '../publish';

const t = ((key: string) => key) as unknown as TFunction;

describe('getPublishFolderLabel', () => {
  it('names the leaf segment of a nested folder path', () => {
    expect(getPublishFolderLabel(['Organization', 'Data Science'], t)).toBe(
      'Data Science',
    );
  });

  it('names the leaf segment of a joined folder path', () => {
    expect(getPublishFolderLabel('Organization/Data Science', t)).toBe(
      'Data Science',
    );
  });

  /*
   * The Organization root has no path segments, so its leaf is the empty
   * string — [#8704](https://github.com/epam/ai-dial-chat/issues/8704), where the confirmation read `folder ""`.
   */
  it('falls back to the root label for the segment-less public root', () => {
    expect(getPublishFolderLabel([], t)).toBe(BasicI18nKeys.Organization);
  });

  it('falls back to the root label for an empty joined path', () => {
    expect(getPublishFolderLabel('', t)).toBe(BasicI18nKeys.Organization);
  });
});

describe('getPublishDependenciesLabels', () => {
  const ENTITY_NOUNS: Record<string, string> = {
    [PublishI18nKeys.DependenciesEntityConversation]: 'conversation',
    [PublishI18nKeys.DependenciesEntityApplication]: 'application',
  };

  const echo = (
    key: string,
    options?: { count?: number; entity?: string },
  ): string => {
    if (options?.entity != null) {
      return `${key}:${options.entity}`;
    }
    if (options?.count != null) {
      return `${key}:${options.count}`;
    }
    return ENTITY_NOUNS[key] ?? key;
  };
  const echoT = echo as unknown as TFunction;

  it('translates the title and splices the entity into the description', () => {
    const labels = getPublishDependenciesLabels(
      echoT,
      PublishI18nKeys.DependenciesEntityConversation,
    );

    expect(labels.title).toBe(PublishI18nKeys.DependenciesTitle);
    expect(labels.description).toBe(
      `${PublishI18nKeys.DependenciesDescription}:conversation`,
    );
  });

  it('translates a label for every kind of dependency', () => {
    const { typeLabels } = getPublishDependenciesLabels(
      echoT,
      PublishI18nKeys.DependenciesEntityApplication,
    );

    expect(typeLabels).toEqual({
      [PublishDependencyType.Application]:
        PublishI18nKeys.DependenciesTypeApplication,
      [PublishDependencyType.Toolset]: PublishI18nKeys.DependenciesTypeToolset,
      [PublishDependencyType.Prompt]: PublishI18nKeys.DependenciesTypePrompt,
      [PublishDependencyType.Skill]: PublishI18nKeys.DependenciesTypeSkill,
      [PublishDependencyType.File]: PublishI18nKeys.DependenciesTypeFile,
    });
  });

  it('passes the count to the announcement so the language can pluralise it', () => {
    const { getAnnouncement } = getPublishDependenciesLabels(
      echoT,
      PublishI18nKeys.DependenciesEntityApplication,
    );

    expect(getAnnouncement?.(3)).toBe(
      `${PublishI18nKeys.DependenciesAnnouncement}:3`,
    );
  });
});

describe('getPublishDependenciesEntityKey', () => {
  it.each([
    [CatalogEntityType.Agent, PublishI18nKeys.DependenciesEntityApplication],
    [CatalogEntityType.Toolset, PublishI18nKeys.DependenciesEntityToolset],
    [CatalogEntityType.Prompt, PublishI18nKeys.DependenciesEntityPrompt],
    [CatalogEntityType.Skill, PublishI18nKeys.DependenciesEntitySkill],
    [CatalogEntityType.Model, PublishI18nKeys.DependenciesEntityItem],
  ])('names a %s item with its own noun', (type, key) => {
    expect(getPublishDependenciesEntityKey(type)).toBe(key);
  });
});
