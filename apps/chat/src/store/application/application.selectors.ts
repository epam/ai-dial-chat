import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { ApplicationState } from './applications.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): ApplicationState => state.application;

const selectAppLoading = createSelector(
  [rootSelector],
  (state) => state.appLoading,
);

const selectIsApplicationLoading = createSelector(
  [selectAppLoading],
  (status) => {
    return status === UploadStatus.LOADING;
  },
);

const selectIsLogsLoading = createSelector([rootSelector], (state) => {
  return state.logsLoadingStatus === UploadStatus.LOADING;
});

const selectApplicationDetail = createSelector([rootSelector], (state) => {
  return state.appDetails;
});

const selectApplicationLogs = createSelector([rootSelector], (state) => {
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

const selectShouldSaveApplication = createSelector(
  [rootSelector],
  (state) => state.shouldSaveApplication,
);

const selectExitAfterSave = createSelector(
  [rootSelector],
  (state) => state.exitAfterSave,
);

const selectPublicFolders = (state: RootState) =>
  rootSelector(state).publicFolders;

export const ApplicationSelectors = {
  selectAppLoading,
  selectIsApplicationLoading,
  selectIsLogsLoading,
  selectApplicationDetail,
  selectShouldSaveApplication,
  selectExitAfterSave,
  selectApplicationLogs,
  selectPublicFolders,
};
