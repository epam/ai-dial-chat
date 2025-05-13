import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { ApplicationState } from './applications.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): ApplicationState => state.application;

const selectAppLoading = (state: RootState) => rootSelector(state).appLoading;

const selectIsApplicationLoading = (state: RootState) =>
  selectAppLoading(state) === UploadStatus.LOADING;

const selectIsLogsLoading = (state: RootState) =>
  rootSelector(state).logsLoadingStatus === UploadStatus.LOADING;

const selectApplicationDetail = (state: RootState) =>
  rootSelector(state).appDetails;

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

const selectShouldSaveApplication = (state: RootState) =>
  rootSelector(state).shouldSaveApplication;

const selectExitAfterSave = (state: RootState) =>
  rootSelector(state).exitAfterSave;

const selectPublicFolders = (state: RootState) =>
  rootSelector(state).publicFolders;

const selectReturnConversationIds = (state: RootState) =>
  rootSelector(state).returnConversationIds;

const selectHasUnsavedChanges = (state: RootState) =>
  rootSelector(state).hasUnsavedChanges;

const selectSelectedWidget = (state: RootState) =>
  rootSelector(state).selectedWidget;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectLogsEntityId = (state: RootState) =>
  rootSelector(state).logsEntityId;

export const ApplicationSelectors = {
  selectAppLoading,
  selectIsApplicationLoading,
  selectIsLogsLoading,
  selectApplicationDetail,
  selectShouldSaveApplication,
  selectExitAfterSave,
  selectApplicationLogs,
  selectPublicFolders,
  selectReturnConversationIds,
  selectHasUnsavedChanges,
  selectInitialized,
  selectSelectedWidget,
  selectLogsEntityId,
};
