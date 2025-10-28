import {
  getApplicationType,
  isApplicationTypeKey,
  isDialAiEntityModel,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';
import { isMyApplication, isMyToolset } from '@/src/utils/app/id';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { EntityType, PageType, SortOrder } from '@/src/types/common';
import {
  DetailsEntity,
  MarketplaceEntity,
  MarketplaceFilters,
} from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';

import { MarketplaceState } from '@/src/store/marketplace/marketplace.types';

import {
  ApplicationTypeToSourceType,
  ENTITY_TYPES,
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
  SourceType,
  TableColumnSortKeys,
} from '@/src/constants/marketplace';

import { pluralizeDisplayName } from './app/application-type-schema';
import { parseCommaSeparatedList } from './app/common';
import { isEntityIdPublic } from './app/publications';
import { isToolsetEntityModel, isToolsetSignedIn } from './app/toolsets';
import { translate } from './app/translation';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import intersection from 'lodash-es/intersection';
import { ParsedUrlQuery } from 'querystring';

export interface EntityStatus {
  isInvalid: boolean;
  isLoggedOut: boolean;
  isError: boolean;
}

export const getEntityStatus = (
  entity: MarketplaceEntity | undefined,
): EntityStatus => {
  const isInvalid = !entity;

  if (isInvalid) {
    return { isInvalid: true, isLoggedOut: false, isError: true };
  }

  if (
    isToolsetEntityModel(entity) &&
    entity.authSettings.authenticationType !== ToolsetAuthTypes.NONE
  ) {
    const isPublic = isEntityIdPublic(entity);

    const authLevel = !isPublic
      ? ToolsetCredentialsLevel.GLOBAL
      : ToolsetCredentialsLevel.USER;

    const isSignedIn = isToolsetSignedIn(entity, authLevel);
    const isLoggedOut = !isSignedIn;

    return {
      isInvalid: false,
      isLoggedOut: isLoggedOut,
      isError: isLoggedOut,
    };
  }

  return { isInvalid: false, isLoggedOut: false, isError: false };
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

//epics utils
export const getDetailsEntity = ({
  entitiesMap,
  reference,
  type,
}: {
  entitiesMap:
    | Partial<Record<string, DialAIEntityModel>>
    | Partial<Record<string, ToolsetModel>>;
  reference: string | undefined;
  type: MarketplaceEntitiesTabs;
}) => {
  const entity =
    typeof reference === 'string' ? entitiesMap[reference] : undefined;

  return entity
    ? {
        reference: entity.reference,
        isSuggested: false,
        type,
      }
    : undefined;
};

export const getTabs = (query: ParsedUrlQuery): Partial<MarketplaceState> => {
  return {
    selectedTab:
      query[MarketplaceQueryParams.tab] === MarketplaceTabs.MY_WORKSPACE
        ? MarketplaceTabs.MY_WORKSPACE
        : MarketplaceTabs.HOME,
    selectedEntitiesTab:
      query[MarketplaceQueryParams.entitiesTab] ===
      MarketplaceEntitiesTabs.TOOLSETS
        ? MarketplaceEntitiesTabs.TOOLSETS
        : MarketplaceEntitiesTabs.AGENTS,
  };
};

export const getFilters = (
  query: ParsedUrlQuery,
  existingTopics: string[],
  sourceTypes: SourceType[],
) => {
  const topics = parseCommaSeparatedList(
    query[MarketplaceQueryParams.topics] as string,
  ).filter((topic) => topic && existingTopics.includes(topic));

  const types = parseCommaSeparatedList(
    query[MarketplaceQueryParams.types] as string,
  ).filter((type) => type && ENTITY_TYPES.includes(type as EntityType));

  const sources = parseCommaSeparatedList(
    query[MarketplaceQueryParams.sources] as string,
  ).filter((type) => type && sourceTypes.includes(type as SourceType));

  return { Type: types, Topics: topics, Sources: sources };
};

export const getTableSort = (query: ParsedUrlQuery) => {
  const tableSortQuery = query[MarketplaceQueryParams.tableSort];
  if (typeof tableSortQuery === 'string') {
    const splittedTableSortQuery = tableSortQuery.split('-');
    const tableSortColumn = (
      splittedTableSortQuery[0] in TableColumnSortKeys
        ? splittedTableSortQuery[0]
        : TableColumnSortKeys.NAME
    ) as TableColumnSortKeys;
    const tableSortOrder: SortOrder =
      splittedTableSortQuery[1] === 'desc' ? 'desc' : 'asc';
    return {
      column: tableSortColumn,
      order: tableSortOrder,
    };
  }
};

export const getLinkErrorMessage = (
  isAgentsTab: boolean,
  reference: string | undefined,
  detailsEntity: DetailsEntity | undefined,
) => {
  if (!detailsEntity && reference) {
    return translate(
      `${isAgentsTab ? 'Agent' : 'Toolset'} by this link not found`,
    );
  }
};
