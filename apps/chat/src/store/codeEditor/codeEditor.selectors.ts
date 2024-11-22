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

export const selectFileContent = createSelector(
  [selectFilesContent, (_filesContent, id: string) => id],
  (filesContent, id) => {
    return filesContent.find((file) => file.id === id);
  },
);

export const selectIsFileContentLoading = createSelector(
  [rootSelector],
  (state) => {
    return state.fileContentLoadingStatus === UploadStatus.LOADING;
  },
);

export const selectSelectedFile = createSelector([rootSelector], (state) => {
  return state.selectedFileId;
});
