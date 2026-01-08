import { RootState } from '@/src/types/store';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.importExport;

const selectAttachmentsIdsToUpload = (state: RootState) =>
  rootSelector(state).attachmentsIdsToUpload;

const selectUploadedAttachments = (state: RootState) =>
  rootSelector(state).uploadedAttachments;

const selectAttachmentsErrors = (state: RootState) =>
  rootSelector(state).attachmentsErrors;

const selectImportedConversations = (state: RootState) =>
  rootSelector(state).importedConversations;

const selectImportStatus = (state: RootState) => rootSelector(state).status;

const selectOperationName = (state: RootState) => rootSelector(state).operation;

const selectIsLoadingImportExport = (state: RootState) =>
  selectImportStatus(state) === UploadStatus.LOADING;

const selectIsShowReplaceDialog = (state: RootState) =>
  rootSelector(state).isShowReplaceDialog;

const selectFeatureType = (state: RootState) => rootSelector(state).featureType;

const selectDuplicatedConversations = (state: RootState) =>
  rootSelector(state).duplicatedConversations;

const selectDuplicatedPrompts = (state: RootState) =>
  rootSelector(state).duplicatedPrompts;

const selectDuplicatedFiles = (state: RootState) =>
  rootSelector(state).duplicatedFiles;

const selectNonDuplicatedFiles = (state: RootState) =>
  rootSelector(state).nonDuplicatedFiles;

const selectIgnoredAttachmentsIds = (state: RootState) =>
  rootSelector(state).ignoredAttachmentsIds;

const selectMappedActions = (state: RootState) =>
  rootSelector(state).mappedActions;

export const ImportExportSelectors = {
  selectAttachmentsIdsToUpload,
  selectUploadedAttachments,
  selectAttachmentsErrors,
  selectImportedConversations,
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
