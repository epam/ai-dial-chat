import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '..';
import { CodeEditorState } from './codeEditor.reducer';

import { UploadStatus } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): CodeEditorState => state.codeEditor;

export const selectFilesContent = createSelector([rootSelector], (state) => {
  return state.filesContent;
});

export const selectModifiedFileIds = createSelector(
  [selectFilesContent],
  (filesContent) => {
    return filesContent.filter((file) => file.modified).map((file) => file.id);
  },
);

export const selectFileContent = (fileId: string) =>
  createSelector([selectFilesContent], (filesContents) => {
    return filesContents.find((file) => file.id === fileId);
  });

export const selectIsFileContentLoading = createSelector(
  [rootSelector],
  (state) => {
    return state.fileContentLoadingStatus === UploadStatus.LOADING;
  },
);

export const selectSelectedFile = createSelector([rootSelector], (state) => {
  return state.selectedFileId;
});
