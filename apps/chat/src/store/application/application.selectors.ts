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

export const selectHasError = createSelector([rootSelector], (state) => {
  return state.error;
});
