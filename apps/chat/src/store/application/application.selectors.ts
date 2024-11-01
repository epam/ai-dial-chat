import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationState } from './application.reducers';

const rootSelector = (state: RootState): ApplicationState => state.application;

export const selectIsLoading = createSelector([rootSelector], (state) => {
  return state.loading;
});

export const selectIsLogsLoading = createSelector([rootSelector], (state) => {
  return state.logsLoading;
});

export const selectApplicationDetail = createSelector(
  [rootSelector],
  (state) => {
    return state.appDetails;
  },
);

export const selectApplicationLogs = createSelector([rootSelector], (state) => {
  return state.appLogs;
});
