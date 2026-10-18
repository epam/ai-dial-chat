import type { CatalogItem } from '@epam/ai-dial-catalog';
import type {
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type {
  DeploymentFolderLabels,
  EntitySpecificDetails,
  MapDeploymentToCatalogItemOptions as MapDeploymentToCatalogItemOptionsLib,
  MapToolsetToCatalogItemOptions as MapToolsetToCatalogItemOptionsLib,
} from '@epam/ai-dial-chat-hooks';
import {
  mapDeploymentToCatalogItem as mapDeploymentToCatalogItemLib,
  mapToolsetToCatalogItem as mapToolsetToCatalogItemLib,
} from '@epam/ai-dial-chat-hooks';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';
import { resolveCatalogIconUrl } from './icon-path';
import { PRIMARY_LOCALE } from './locale';

/** Builds the translated Personal/Shared/Public folder labels the lib's folder resolvers need. */
export const buildDeploymentFolderLabels = (
  t: TFunction,
): DeploymentFolderLabels => ({
  personal: t(CatalogI18nKeys.FolderPersonal),
  shared: t(CatalogI18nKeys.FolderShared),
  public: t(CatalogI18nKeys.FolderPublic),
});

export interface MapDeploymentToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  entityDetails?: EntitySpecificDetails;
  t: TFunction;
  editableSchemaIds?: string[];
  isCustomAppsEditable?: boolean;
  activeLocale?: string;
}

export const mapDeploymentToCatalogItem = (
  deployment: DeploymentItemDto,
  {
    favoriteIds,
    entityDetails,
    t,
    editableSchemaIds,
    isCustomAppsEditable,
    activeLocale = PRIMARY_LOCALE,
  }: MapDeploymentToCatalogItemOptions,
): CatalogItem => {
  const options: MapDeploymentToCatalogItemOptionsLib = {
    favoriteIds,
    entityDetails,
    editableSchemaIds,
    isCustomAppsEditable,
    activeLocale,
    primaryLocale: PRIMARY_LOCALE,
    resolveIconUrl: resolveCatalogIconUrl,
    folderLabels: buildDeploymentFolderLabels(t),
  };
  return mapDeploymentToCatalogItemLib(deployment, options);
};

export interface MapToolsetToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  isAdmin?: boolean;
  t?: TFunction;
  activeLocale?: string;
}

export const mapToolsetToCatalogItem = (
  toolset: DialToolsetDto,
  {
    favoriteIds,
    isAdmin,
    t,
    activeLocale = PRIMARY_LOCALE,
  }: MapToolsetToCatalogItemOptions = {},
): CatalogItem => {
  const options: MapToolsetToCatalogItemOptionsLib = {
    favoriteIds,
    isAdmin,
    activeLocale,
    primaryLocale: PRIMARY_LOCALE,
    resolveIconUrl: resolveCatalogIconUrl,
    folderLabels: t != null ? buildDeploymentFolderLabels(t) : undefined,
  };
  return mapToolsetToCatalogItemLib(toolset, options);
};
