import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { CodeEditorState } from './codeEditor.types';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): CodeEditorState => state.codeEditor;

const selectFilesContent = (state: RootState) =>
  rootSelector(state).filesContent;

const selectModifiedFileIds = createSelector(
  [selectFilesContent],
  (filesContent) => {
    return filesContent.filter((file) => file.modified).map((file) => file.id);
  },
);

const selectIsDirty = createSelector(
  [selectModifiedFileIds],
  (ids) => !!ids.length,
);

const selectFileContent = (fileId: string) =>
  createSelector([selectFilesContent], (filesContents) => {
    return filesContents.find((file) => file.id === fileId);
  });

const selectIsFileContentLoading = (state: RootState) =>
  rootSelector(state).fileContentLoadingStatus === UploadStatus.LOADING;

const selectSelectedFile = (state: RootState) =>
  rootSelector(state).selectedFileId;

export const CodeEditorSelectors = {
  selectFilesContent,
  selectModifiedFileIds,
  selectIsDirty,
  selectFileContent,
  selectIsFileContentLoading,
  selectSelectedFile,
};
