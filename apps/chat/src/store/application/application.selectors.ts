import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationState } from './application.reducers';

const rootSelector = (state: RootState): ApplicationState => state.application;

export const selectIsLoading = createSelector([rootSelector], (state) => {
  return state.loading;
});

export const selectApplication = createSelector([rootSelector], (state) => {
  return state.application;
});

export const selectApplications = createSelector([rootSelector], (state) => {
  return state.applications;
});

export const selectApplicationById = createSelector(
  [rootSelector, (_, id) => id],
  (state, id) => {
    return state.applications.find((application) => application.url === id);
  },
);

export const selectHasError = createSelector([rootSelector], (state) => {
  return state.error;
});

export const selectApplicationDetail = createSelector(
  [rootSelector],
  (state) => {
    return state.appDetails;
  },
);
