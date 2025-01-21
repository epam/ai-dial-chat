import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationState } from './application.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): ApplicationState => state.application;

export const selectAppLoading = createSelector(
  [rootSelector],
  (state) => state.appLoading,
);

export const selectIsApplicationLoading = createSelector(
  [selectAppLoading],
  (status) => {
    return status === UploadStatus.LOADING;
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
  const ansiRegex = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[mK]', 'g');
  const errorLogRegex =
    /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \| .+ \| .+ \| (.+)$/;

  return state.appLogs?.logs[0]?.content
    .split('\n')
    .map((line) => {
      const cleanedLine = line.replace(ansiRegex, '');
      const match = errorLogRegex.exec(cleanedLine);
      if (match) {
        return `${match[1]} | ${match[2]}\n`;
      } else {
        return cleanedLine + '\n';
      }
    })
    .join('');
});
