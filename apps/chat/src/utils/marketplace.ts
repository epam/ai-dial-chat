import {
  getApplicationType,
  isApplicationPublic,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';

import { MarketplaceFilters } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import {
  ApplicationTypeToSourceType,
  FilterTypes,
  SourceType,
} from '@/src/constants/marketplace';

import intersection from 'lodash-es/intersection';

export const doesApplicationMatchSearchTerm = (
  model: DialAIEntityModel,
  searchTerm: string,
) => {
  return (
    doesEntityContainSearchTerm(model, searchTerm) ||
    (model.version &&
      doesEntityContainSearchTerm({ name: model.version }, searchTerm))
  );
};

export const doesApplicationMatchFilters = (
  model: DialAIEntityModel,
  selectedFilters: MarketplaceFilters,
) => {
  if (
    selectedFilters[FilterTypes.ENTITY_TYPE].length &&
    !selectedFilters[FilterTypes.ENTITY_TYPE].includes(model.type)
  ) {
    return false;
  }

  if (
    selectedFilters[FilterTypes.TOPICS].length &&
    !intersection(selectedFilters[FilterTypes.TOPICS], model.topics).length
  ) {
    return false;
  }

  if (selectedFilters[FilterTypes.SOURCES].length) {
    const sources = selectedFilters[FilterTypes.SOURCES];
    const applicationType = getApplicationType(model);
    if (
      (sources.includes(SourceType.Public) && isApplicationPublic(model)) ||
      (sources.includes(SourceType.SharedWithMe) && model.sharedWithMe) ||
      (isMyApplication(model) &&
        sources.includes(ApplicationTypeToSourceType[applicationType]))
    ) {
      return true;
    }
    return false;
  }

  return true;
};
