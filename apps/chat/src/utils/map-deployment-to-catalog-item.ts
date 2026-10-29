import type { CatalogItem } from '@epam/ai-dial-catalog';
import type {
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import type {
  DeploymentFolderLabels,
  EntityDetailsLabels,
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

/** Builds the translated catalog Overview labels the lib's entity-details mapper needs. */
export const buildEntityDetailsLabels = (t: TFunction): EntityDetailsLabels => ({
  capabilitiesTitle: t(CatalogI18nKeys.EntityDetailsCapabilitiesTitle),
  specificationTitle: t(CatalogI18nKeys.EntityDetailsSpecificationTitle),
  configurationTitle: t(CatalogI18nKeys.EntityDetailsConfigurationTitle),
  tools: t(CatalogI18nKeys.EntityDetailsTools),
  parallelToolCalls: t(CatalogI18nKeys.EntityDetailsParallelToolCalls),
  reasoningEfforts: t(CatalogI18nKeys.EntityDetailsReasoningEfforts),
  skills: t(CatalogI18nKeys.EntityDetailsSkills),
  provider: t(CatalogI18nKeys.EntityDetailsProvider),
  vendor: t(CatalogI18nKeys.EntityDetailsVendor),
  license: t(CatalogI18nKeys.EntityDetailsLicense),
  knowledgeCutoffDate: t(CatalogI18nKeys.EntityDetailsKnowledgeCutoffDate),
  parameters: t(CatalogI18nKeys.EntityDetailsParameters),
  hostedBy: t(CatalogI18nKeys.EntityDetailsHostedBy),
  releaseDate: t(CatalogI18nKeys.EntityDetailsReleaseDate),
  contextWindow: t(CatalogI18nKeys.EntityDetailsContextWindow),
  maxOutputTokens: t(CatalogI18nKeys.EntityDetailsMaxOutputTokens),
  inputModalities: t(CatalogI18nKeys.EntityDetailsInputModalities),
  inputAttachments: t(CatalogI18nKeys.EntityDetailsInputAttachments),
  routes: t(CatalogI18nKeys.EntityDetailsRoutes),
  configurationSchema: t(CatalogI18nKeys.EntityDetailsConfigurationSchema),
  authentication: t(CatalogI18nKeys.EntityDetailsAuthentication),
  authorizationEndpoint: t(CatalogI18nKeys.EntityDetailsAuthorizationEndpoint),
  tokenEndpoint: t(CatalogI18nKeys.EntityDetailsTokenEndpoint),
  oauthScopes: t(CatalogI18nKeys.EntityDetailsOauthScopes),
});

export interface MapDeploymentToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  entityDetails?: EntitySpecificDetails;
  t: TFunction;
  editableSchemaIds?: string[];
  isCustomAppsEditable?: boolean;
  activeLocale?: string;
  isToolsetTabEnabled?: boolean;
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
    isToolsetTabEnabled,
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
    entityDetailsLabels: buildEntityDetailsLabels(t),
    isToolsetTabEnabled,
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
