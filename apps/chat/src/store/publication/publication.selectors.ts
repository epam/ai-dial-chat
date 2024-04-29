import { createSelector } from '@reduxjs/toolkit';

import { BackendResourceType } from '@/src/types/common';
import { PublicationStatus } from '@/src/types/publication';

import { RootState } from '../index';
import { PublicationState } from './publication.reducers';

const rootSelector = (state: RootState): PublicationState => state.publication;

export const selectPublications = createSelector([rootSelector], (state) => {
  return state.publications;
});

export const selectFilteredPublications = createSelector(
  [rootSelector, (_state, resourceType: BackendResourceType) => resourceType],
  (state, resourceType) => {
    return state.publications.filter((p) =>
      p.resourceTypes.includes(resourceType),
    );
  },
);

export const selectPendingPublications = createSelector(
  [selectPublications],
  (publications) => {
    return publications.filter((p) => p.status === PublicationStatus.PENDING);
  },
);

export const selectRequestedForDeletionPublications = createSelector(
  [selectPublications],
  (publications) => {
    return publications.filter(
      (p) => p.status === PublicationStatus.REQUESTED_FOR_DELETION,
    );
  },
);

export const selectSelectedPublication = createSelector(
  [rootSelector],
  (state) => state.selectedPublication,
);
