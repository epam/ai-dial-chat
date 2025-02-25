import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { ImportExportState } from './importExport.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): ImportExportState =>
  state.importExport;

const selectAttachmentsIdsToUpload = createSelector([rootSelector], (state) => {
  return state.attachmentsIdsToUpload;
});
const selectUploadedAttachments = createSelector([rootSelector], (state) => {
  return state.uploadedAttachments;
});

const selectAttachmentsErrors = createSelector([rootSelector], (state) => {
  return state.attachmentsErrors;
});

const selectImportedConversations = createSelector([rootSelector], (state) => {
  return state.importedConversations;
});

const selectImportStatus = createSelector([rootSelector], (state) => {
  return state.status;
});

const selectOperationName = createSelector([rootSelector], (state) => {
  return state.operation;
});

const selectIsLoadingImportExport = createSelector([rootSelector], (state) => {
  return state.status === UploadStatus.LOADING;
});

const selectIsShowReplaceDialog = createSelector([rootSelector], (state) => {
  return state.isShowReplaceDialog;
});

const selectFeatureType = createSelector([rootSelector], (state) => {
  return state.featureType;
});

const selectDuplicatedConversations = createSelector(
  [rootSelector],
  (state) => {
    return state.duplicatedConversations;
  },
);

const selectDuplicatedPrompts = createSelector([rootSelector], (state) => {
  return state.duplicatedPrompts;
});

const selectDuplicatedFiles = createSelector([rootSelector], (state) => {
  return state.duplicatedFiles;
});

const selectNonDuplicatedFiles = createSelector([rootSelector], (state) => {
  return state.nonDuplicatedFiles;
});

const selectIgnoredAttachmentsIds = createSelector([rootSelector], (state) => {
  return state.ignoredAttachmentsIds;
});

const selectMappedActions = createSelector([rootSelector], (state) => {
  return state.mappedActions;
});

export const ImportExportSelectors = {
  selectAttachmentsIdsToUpload,
  selectUploadedAttachments,
  selectAttachmentsErrors,
  selectImportedConversations,
  selectImportStatus,
  selectOperationName,
  selectIsLoadingImportExport,
  selectIsShowReplaceDialog,
  selectFeatureType,
  selectDuplicatedConversations,
  selectDuplicatedPrompts,
  selectDuplicatedFiles,
  selectNonDuplicatedFiles,
  selectIgnoredAttachmentsIds,
  selectMappedActions,
};
