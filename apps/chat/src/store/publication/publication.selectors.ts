import { createSelector } from '@reduxjs/toolkit';

import { EnumMapper } from '@/src/utils/app/mappers';

import { FeatureType } from '@/src/types/common';
import { PublicationResource } from '@/src/types/publication';

import { selectConversations } from '../conversations/conversations.selectors';
import { RootState } from '../index';
import { selectPrompts } from '../prompts/prompts.selectors';
import { PublicationState } from './publication.reducers';

const rootSelector = (state: RootState): PublicationState => state.publication;

export const selectPublications = createSelector([rootSelector], (state) => {
  return state.publications;
});

export const selectFilteredPublications = createSelector(
  [rootSelector, (_state, featureType: FeatureType) => featureType],
  (state, featureType) => {
    return state.publications.filter((p) =>
      p.resourceTypes.includes(
        EnumMapper.getBackendResourceTypeByFeatureType(featureType),
      ),
    );
  },
);

export const selectFilteredPublicationResources = createSelector(
  [selectFilteredPublications],
  (filteredPublications) => {
    return filteredPublications
      .filter((p) => p.resources)
      .flatMap((p) => p.resources) as PublicationResource[];
  },
);

export const selectSelectedPublication = createSelector(
  [rootSelector],
  (state) => {
    return state.selectedPublication;
  },
);

export const selectResourceToReview = createSelector(
  [rootSelector],
  (state) => {
    return state.resourcesToReview;
  },
);

export const selectResourceToReviewByReviewUrl = createSelector(
  [rootSelector, (_state, id: string) => id],
  (state, id) => {
    return state.resourcesToReview.find((r) => r.reviewUrl === id);
  },
);

export const selectResourcesToReviewByPublicationUrl = createSelector(
  [rootSelector, (_state, id: string) => id],
  (state, id) => {
    return state.resourcesToReview.filter((r) => r.publicationUrl === id);
  },
);

export const selectRulesByPath = createSelector(
  [rootSelector, (_state, path: string) => path],
  (state, path) => {
    return Object.fromEntries(
      Object.entries(state.rules).filter(
        ([key]) => path.startsWith(key) && key.split('/').length !== 1,
      ),
    );
  },
);

export const selectIsRulesLoading = createSelector([rootSelector], (state) => {
  return state.isRulesLoading;
});

export const selectIsAllItemsUploaded = createSelector(
  [rootSelector, (_state, featureType: FeatureType) => featureType],
  (state, featureType) => {
    return state.allPublishedWithMeItemsUploaded[featureType];
  },
);

export const selectNonExistentEntities = createSelector(
  [selectConversations, selectPrompts],
  (conversations, prompts) => {
    return [...conversations, ...prompts].filter(
      (entity) => entity.publicationInfo?.isNotExist,
    );
  },
);
