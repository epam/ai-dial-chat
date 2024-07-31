import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationState } from './application.reducers';

// Base root selector function
const rootSelector = (state: RootState): ApplicationState => state.application;

// Single Selectors
const selectIsLoading = (state: ApplicationState) => state.loading;
const selectApplication = (state: ApplicationState) => state.application;
const selectApplications = (state: ApplicationState) => state.applications;
const selectHasError = (state: ApplicationState) => state.error;
const selectApplicationDetail = (state: ApplicationState) => state.appDetails;

export const singleSelectors = {
  isLoading: selectIsLoading,
  application: selectApplication,
  applications: selectApplications,
  hasError: selectHasError,
  applicationDetail: selectApplicationDetail,
};

// createSelector-based Selectors
export const applicationSelectors = {
  isLoading: createSelector([rootSelector], singleSelectors.isLoading),
  application: createSelector([rootSelector], singleSelectors.application),
  applications: createSelector([rootSelector], singleSelectors.applications),
  hasError: createSelector([rootSelector], singleSelectors.hasError),
  applicationDetail: createSelector(
    [rootSelector],
    singleSelectors.applicationDetail,
  ),
};
