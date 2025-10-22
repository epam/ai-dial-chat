import {
  getApplicationType,
  isApplicationTypeKey,
  isDialAiEntityModel,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';
import { isMyApplication, isMyToolset } from '@/src/utils/app/id';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { EntityType, PageType } from '@/src/types/common';
import { MarketplaceEntity, MarketplaceFilters } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';

import {
  ApplicationTypeToSourceType,
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  SourceType,
} from '@/src/constants/marketplace';

import { pluralizeDisplayName } from './app/application-type-schema';

import intersection from 'lodash-es/intersection';

export interface EntityStatus {
  isInvalid: boolean;
  isLoggedOut: boolean;
  isError: boolean;
}

export const getEntityStatus = (
  item: MarketplaceEntity | undefined,
): EntityStatus => {
  const isInvalid = !item;

  const isLoggedOut =
    !!item &&
    item.type === EntityType.Toolset &&
    'authSettings' in item &&
    !!item?.authSettings?.authenticationType;

  const isError = isInvalid || isLoggedOut;

  return {
    isInvalid,
    isLoggedOut,
    isError,
  };
};

// Filter checkers
const checkEntityTypeFilter = (
  marketplaceEntity: MarketplaceEntity,
  entityTypes?: string[],
) => !entityTypes?.length || entityTypes.includes(marketplaceEntity.type);

const checkTopicsFilter = (
  marketplaceEntity: MarketplaceEntity,
  topics?: string[],
) =>
  !topics?.length || intersection(topics, marketplaceEntity.topics).length > 0;

const checkDialAiApplicationSources = (
  model: MarketplaceEntity,
  sources: string[],
  schemas?: ApplicationTypeSchema[],
) => {
  if (!isDialAiEntityModel(model) || !isMyApplication(model)) return false;

  const applicationType = getApplicationType(model);
  const displayName = schemas?.find(
    (schema) => schema.id === applicationType,
  )?.displayName;

  return (
    (isApplicationTypeKey(applicationType) &&
      sources.includes(ApplicationTypeToSourceType[applicationType])) ||
    (displayName && sources.includes(pluralizeDisplayName(displayName)))
  );
};

const checkSourcesFilter = (
  marketplaceEntity: MarketplaceEntity,
  sources?: string[],
  applicationTypeSchemas?: ApplicationTypeSchema[],
) => {
  if (!sources?.length) return true;

  return [
    () =>
      sources.includes(SourceType.Public) &&
      isMarketplaceEntityPublic(marketplaceEntity),
    () =>
      sources.includes(SourceType.SharedWithMe) &&
      marketplaceEntity.sharedWithMe,
    () =>
      sources.includes(SourceType.MyToolsets) && isMyToolset(marketplaceEntity),
    () =>
      checkDialAiApplicationSources(
        marketplaceEntity,
        sources,
        applicationTypeSchemas,
      ),
  ].some((check) => check());
};

export const doesMarketplaceEntityMatchFilters = (
  marketplaceEntity: MarketplaceEntity,
  selectedFilters: Partial<MarketplaceFilters>,
  applicationTypeSchemas?: ApplicationTypeSchema[],
) => {
  return (
    checkEntityTypeFilter(
      marketplaceEntity,
      selectedFilters[FilterTypes.ENTITY_TYPE],
    ) &&
    checkTopicsFilter(marketplaceEntity, selectedFilters[FilterTypes.TOPICS]) &&
    checkSourcesFilter(
      marketplaceEntity,
      selectedFilters[FilterTypes.SOURCES],
      applicationTypeSchemas,
    )
  );
};

export const getApplicationLink = (entity: DialAIEntityModel) => {
  return `${window.location.origin}/${PageType.Marketplace}?${MarketplaceQueryParams.model}=${entity.reference}`;
};

export const getToolsetLink = (entity: ToolsetModel) => {
  return `${window.location.origin}/${PageType.Marketplace}?${MarketplaceQueryParams.toolset}=${entity.reference}&${MarketplaceQueryParams.entitiesTab}=${MarketplaceEntitiesTabs.TOOLSETS}`;
};

export const isInstalledEntity = (
  entity: { reference: string },
  installedEntitiesSet: Set<string>,
) => installedEntitiesSet.has(entity.reference);
