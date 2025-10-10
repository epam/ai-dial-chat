import {
  getApplicationType,
  isApplicationTypeKey,
  isDialAiEntityModel,
  isMarketplaceEntityPublic,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { EntityType, PageType } from '@/src/types/common';
import { MarketplaceEntity, MarketplaceFilters } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import {
  ApplicationTypeToSourceType,
  FilterTypes,
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

export const doesMarketplaceEntityMatchFilters = (
  model: MarketplaceEntity,
  selectedFilters: Partial<MarketplaceFilters>,
  applicationTypeSchemas?: ApplicationTypeSchema[],
) => {
  if (
    selectedFilters[FilterTypes.ENTITY_TYPE]?.length &&
    !selectedFilters[FilterTypes.ENTITY_TYPE].includes(model.type)
  ) {
    return false;
  }

  if (
    selectedFilters[FilterTypes.TOPICS]?.length &&
    !intersection(selectedFilters[FilterTypes.TOPICS], model.topics).length
  ) {
    return false;
  }

  if (
    selectedFilters[FilterTypes.SOURCES]?.length &&
    isDialAiEntityModel(model)
  ) {
    const sources = selectedFilters[FilterTypes.SOURCES];
    const applicationType = getApplicationType(model);
    const displayName = applicationTypeSchemas?.find(
      (schema) => schema.id === applicationType,
    )?.displayName;

    if (
      (sources.includes(SourceType.Public) &&
        isMarketplaceEntityPublic(model)) ||
      (sources.includes(SourceType.SharedWithMe) && model.sharedWithMe) ||
      (isMyApplication(model) &&
        isApplicationTypeKey(applicationType) &&
        sources.includes(ApplicationTypeToSourceType[applicationType])) ||
      (isMyApplication(model) &&
        displayName &&
        sources.includes(pluralizeDisplayName(displayName)))
    ) {
      return true;
    }
    return false;
  }

  return true;
};

export const getApplicationLink = (entity: DialAIEntityModel) => {
  return `${window.location.origin}/${PageType.Marketplace}?${MarketplaceQueryParams.model}=${entity.reference}`;
};

export const isInstalledEntity = (
  entity: { reference: string },
  installedEntitiesSet: Set<string>,
) => installedEntitiesSet.has(entity.reference);
