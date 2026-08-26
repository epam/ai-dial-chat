import type {
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import {
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../map-deployment-to-catalog-item';

/*
 * The mapping algorithm itself is covered by
 * `libs/chat-hooks/src/catalog/tests/map-deployment-to-catalog-item.spec.ts`.
 * This spec covers only what the app wrapper adds: building the folder
 * labels from `t()` and defaulting `activeLocale`/`primaryLocale`/
 * `resolveIconUrl`.
 */
describe('mapDeploymentToCatalogItem', () => {
  const t = ((key: string) => key) as TFunction;

  const baseDeployment: DeploymentItemDto = {
    id: 'applications/bucket/My App__1.0',
    displayName: 'My App',
    type: 'application',
    isMy: true,
  };

  it('translates the Personal folder via t()', () => {
    const result = mapDeploymentToCatalogItem(baseDeployment, { t });

    expect(result.folder).toEqual([CatalogI18nKeys.FolderPersonal]);
  });

  it('translates the Shared folder via t()', () => {
    const result = mapDeploymentToCatalogItem(
      { ...baseDeployment, isMy: false, sharedWithMe: true },
      { t },
    );

    expect(result.folder).toEqual([CatalogI18nKeys.FolderShared]);
  });

  it('translates the Public folder via t()', () => {
    const result = mapDeploymentToCatalogItem(
      {
        ...baseDeployment,
        isMy: false,
        applicationFolder: 'applications/public/team',
      },
      { t },
    );

    expect(result.folder).toEqual([CatalogI18nKeys.FolderPublic, 'team']);
  });
});

describe('mapToolsetToCatalogItem', () => {
  it('omits the translated Personal label (falls through to the raw segments) when t is not supplied', () => {
    const result = mapToolsetToCatalogItem({
      id: 'toolsets/bucket/folder/salesforce',
      toolset: 'toolsets/bucket/folder/salesforce',
      isMy: true,
    } as DialToolsetDto);

    expect(result.folder).toEqual(['folder']);
  });

  it('translates the Personal folder via t() when supplied', () => {
    const t = ((key: string) => key) as TFunction;

    const result = mapToolsetToCatalogItem(
      {
        id: 'toolsets/bucket/folder/salesforce',
        toolset: 'toolsets/bucket/folder/salesforce',
        isMy: true,
      } as DialToolsetDto,
      { t },
    );

    expect(result.folder).toEqual([CatalogI18nKeys.FolderPersonal]);
  });
});
