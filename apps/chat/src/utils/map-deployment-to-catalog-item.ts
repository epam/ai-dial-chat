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
import {
  CatalogI18nKeys,
  ToolsetEditorI18nKeys,
} from '../constants/translation-keys';
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
export const buildEntityDetailsLabels = (
  t: TFunction,
): EntityDetailsLabels => ({
  capabilitiesTitle: t(CatalogI18nKeys.EntityDetailsCapabilitiesTitle),
  specificationTitle: t(CatalogI18nKeys.DetailsSpecificationSection),
  configurationTitle: t(CatalogI18nKeys.EntityDetailsConfigurationTitle),
  tools: t(CatalogI18nKeys.DetailsTabTools),
  parallelToolCalls: t(CatalogI18nKeys.EntityDetailsParallelToolCalls),
  reasoningEfforts: t(CatalogI18nKeys.EntityDetailsReasoningEfforts),
  skills: t(CatalogI18nKeys.TabSkills),
  provider: t(CatalogI18nKeys.EntityDetailsProvider),
  vendor: t(CatalogI18nKeys.EntityDetailsVendor),
  license: t(CatalogI18nKeys.EntityDetailsLicense),
  knowledgeCutoffDate: t(CatalogI18nKeys.EntityDetailsKnowledgeCutoffDate),
  parameters: t(CatalogI18nKeys.EntityDetailsParameters),
  hostedBy: t(CatalogI18nKeys.EntityDetailsHostedBy),
  releaseDate: t(CatalogI18nKeys.EntityDetailsReleaseDate),
  deprecationDate: t(CatalogI18nKeys.EntityDetailsDeprecationDate),
  endOfService: t(CatalogI18nKeys.EntityDetailsEndOfService),
  contextWindow: t(CatalogI18nKeys.EntityDetailsContextWindow),
  maxOutputTokens: t(CatalogI18nKeys.EntityDetailsMaxOutputTokens),
  inputModalities: t(CatalogI18nKeys.EntityDetailsInputModalities),
  inputAttachments: t(CatalogI18nKeys.EntityDetailsInputAttachments),
  routes: t(CatalogI18nKeys.EntityDetailsRoutes),
  configurationSchema: t(CatalogI18nKeys.EntityDetailsConfigurationSchema),
  authentication: t(ToolsetEditorI18nKeys.AuthSectionTitle),
  authorizationEndpoint: t(ToolsetEditorI18nKeys.AuthorizationEndpointLabel),
  tokenEndpoint: t(ToolsetEditorI18nKeys.TokenEndpointLabel),
  oauthScopes: t(CatalogI18nKeys.EntityDetailsOauthScopes),
});

/*
 * The mappers below run once per deployment or toolset — thousands of times
 * per catalog build — and the label objects depend only on `t`. Building them
 * per item cost 29 i18next lookups each, about a second of main-thread time
 * for a 2,400-entity catalog. `t` changes identity when the language changes,
 * so a cache keyed by it never serves labels of a previous language.
 */
const folderLabelsCache = new WeakMap<TFunction, DeploymentFolderLabels>();
const entityDetailsLabelsCache = new WeakMap<TFunction, EntityDetailsLabels>();

const getDeploymentFolderLabels = (t: TFunction): DeploymentFolderLabels => {
  let labels = folderLabelsCache.get(t);
  if (labels == null) {
    labels = buildDeploymentFolderLabels(t);
    folderLabelsCache.set(t, labels);
  }
  return labels;
};

const getEntityDetailsLabels = (t: TFunction): EntityDetailsLabels => {
  let labels = entityDetailsLabelsCache.get(t);
  if (labels == null) {
    labels = buildEntityDetailsLabels(t);
    entityDetailsLabelsCache.set(t, labels);
  }
  return labels;
};

export interface MapDeploymentToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  entityDetails?: EntitySpecificDetails;
  t: TFunction;
  editableSchemaIds?: string[];
  isCustomAppsEditable?: boolean;
  activeLocale?: string;
  isToolsetTabEnabled?: boolean;
  /** Base URL of the themes service, from the client config. */
  themesBaseUrl?: string | null;
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
    themesBaseUrl,
  }: MapDeploymentToCatalogItemOptions,
): CatalogItem => {
  const options: MapDeploymentToCatalogItemOptionsLib = {
    favoriteIds,
    entityDetails,
    editableSchemaIds,
    isCustomAppsEditable,
    activeLocale,
    primaryLocale: PRIMARY_LOCALE,
    resolveIconUrl: (iconUrl) => resolveCatalogIconUrl(iconUrl, themesBaseUrl),
    folderLabels: getDeploymentFolderLabels(t),
    entityDetailsLabels: getEntityDetailsLabels(t),
    isToolsetTabEnabled,
  };
  return mapDeploymentToCatalogItemLib(deployment, options);
};

export interface MapToolsetToCatalogItemOptions {
  favoriteIds?: ReadonlySet<string>;
  isAdmin?: boolean;
  t?: TFunction;
  activeLocale?: string;
  /** Base URL of the themes service, from the client config. */
  themesBaseUrl?: string | null;
}

export const mapToolsetToCatalogItem = (
  toolset: DialToolsetDto,
  {
    favoriteIds,
    isAdmin,
    t,
    activeLocale = PRIMARY_LOCALE,
    themesBaseUrl,
  }: MapToolsetToCatalogItemOptions = {},
): CatalogItem => {
  const options: MapToolsetToCatalogItemOptionsLib = {
    favoriteIds,
    isAdmin,
    activeLocale,
    primaryLocale: PRIMARY_LOCALE,
    resolveIconUrl: (iconUrl) => resolveCatalogIconUrl(iconUrl, themesBaseUrl),
    folderLabels: t != null ? getDeploymentFolderLabels(t) : undefined,
  };
  return mapToolsetToCatalogItemLib(toolset, options);
};
