import {
  isApplicationPublic,
  isExecutableApp,
  isQuickApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';

import { MarketplaceFilters } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import { FilterTypes, SourceType } from '@/src/constants/marketplace';

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
    if (
      (sources.includes(SourceType.Public) && isApplicationPublic(model)) ||
      (sources.includes(SourceType.SharedWithMe) && model.sharedWithMe) ||
      (sources.includes(SourceType.MyQuickApps) &&
        isMyApplication(model) &&
        isQuickApp(model)) ||
      (sources.includes(SourceType.MyCodeApps) &&
        isMyApplication(model) &&
        isExecutableApp(model)) ||
      (sources.includes(SourceType.MyCustomApps) &&
        isMyApplication(model) &&
        !isExecutableApp(model) &&
        !isQuickApp(model))
    ) {
      return true;
    }
    return false;
  }

  return true;
};
