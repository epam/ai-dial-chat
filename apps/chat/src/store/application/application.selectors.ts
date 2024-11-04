import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationState } from './application.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): ApplicationState => state.application;

export const selectIsApplicationLoading = createSelector(
  [rootSelector],
  (state) => {
    return state.appLoading === UploadStatus.LOADING;
  },
);

export const selectIsLogsLoading = createSelector([rootSelector], (state) => {
  return state.logsLoadingStatus === UploadStatus.LOADING;
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
