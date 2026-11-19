import type {
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import {
  buildEntityDetailsLabels,
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../map-deployment-to-catalog-item';

describe('buildEntityDetailsLabels', () => {
  it('translates the deprecation date and end of service labels via t()', () => {
    const t = ((key: string) => key) as TFunction;

    expect(buildEntityDetailsLabels(t)).toMatchObject({
      deprecationDate: CatalogI18nKeys.EntityDetailsDeprecationDate,
      endOfService: CatalogI18nKeys.EntityDetailsEndOfService,
    });
  });
});

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

  it('builds the translated labels once per t(), not once per deployment', () => {
    const countingT = vi.fn((key: string) => key) as unknown as TFunction;

    mapDeploymentToCatalogItem(baseDeployment, { t: countingT });
    const callsForOneDeployment = vi.mocked(countingT).mock.calls.length;
    mapDeploymentToCatalogItem(
      { ...baseDeployment, id: 'applications/bucket/Other__1.0' },
      { t: countingT },
    );

    expect(callsForOneDeployment).toBeGreaterThan(0);
    expect(vi.mocked(countingT).mock.calls).toHaveLength(callsForOneDeployment);
  });

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
  it('translates the Organization label for a toolset with a plain ID', () => {
    const t = ((key: string) => key) as TFunction;

    const result = mapToolsetToCatalogItem(
      { id: 'salesforce', toolset: 'salesforce' },
      { t },
    );

    expect(result.folder).toEqual([CatalogI18nKeys.FolderPublic]);
  });

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

    expect(result.folder).toEqual([CatalogI18nKeys.FolderPersonal, 'folder']);
  });
});
