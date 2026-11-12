import { PublishDependencyType } from '@epam/ai-dial-publish-panel';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  BasicI18nKeys,
  PublishI18nKeys,
} from '../../constants/translation-keys';
import {
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
  const echoT = ((
    key: string,
    options?: { count?: number; entity?: string },
  ) =>
    options?.entity != null
      ? `${key}:${options.entity}`
      : options?.count == null
        ? key
        : `${key}:${options.count}`) as unknown as TFunction;

  it('translates the title and splices the entity into the description', () => {
    const labels = getPublishDependenciesLabels(
      echoT,
      PublishI18nKeys.DependenciesEntityConversation,
    );

    expect(labels.title).toBe(PublishI18nKeys.DependenciesTitle);
    expect(labels.description).toBe(
      `${PublishI18nKeys.DependenciesDescription}:${PublishI18nKeys.DependenciesEntityConversation}`,
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
