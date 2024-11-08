import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import * as CodeEditorSelectors from './codeEditor.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';
import { uniqBy } from 'lodash-es';

export { CodeEditorSelectors };

export interface CodeEditorState {
  filesContent: {
    id: string;
    content: string;
    modifiedContent: string | undefined;
    modified: boolean;
  }[];
  fileContentLoadingStatus: UploadStatus;
  selectedFileId: string | undefined;
}

const initialState: CodeEditorState = {
  fileContentLoadingStatus: UploadStatus.LOADED,
  filesContent: [],
  selectedFileId: undefined,
};

export const codeEditorSlice = createSlice({
  name: 'codeEditor',
  initialState,
  reducers: {
    initCodeEditor: (
      state,
      _action: PayloadAction<{ sourcesFolderId: string }>,
    ) => {
      state.selectedFileId = undefined;
      state.filesContent = [];
    },
    resetCodeEditor: (state) => {
      state.selectedFileId = undefined;
      state.filesContent = [];
    },
    initCodeSuccess: (
      state,
      { payload }: PayloadAction<{ selectedFileId: string }>,
    ) => {
      state.selectedFileId = payload.selectedFileId;
    },
    getFileTextContent: (state, _action: PayloadAction<{ id: string }>) => {
      state.fileContentLoadingStatus = UploadStatus.LOADING;
    },
    getFileTextContentFail: (state) => {
      state.fileContentLoadingStatus = UploadStatus.FAILED;
    },
    getFileTextContentSuccess: (
      state,
      { payload }: PayloadAction<{ id: string; content: string }>,
    ) => {
      state.filesContent = uniqBy(
        [
          { ...payload, modifiedContent: undefined, modified: false },
          ...state.filesContent,
        ],
        'id',
      );
      state.fileContentLoadingStatus = UploadStatus.LOADED;
    },
    modifyFileContent: (
      state,
      { payload }: PayloadAction<{ fileId: string; content: string }>,
    ) => {
      state.filesContent = state.filesContent.map((file) => {
        if (file.id === payload.fileId) {
          const modified = payload.content !== file.content;

          return {
            ...file,
            modifiedContent: modified ? payload.content : undefined,
            modified,
          };
        }
        return file;
      });
    },
    setSelectedFileId: (
      state,
      { payload }: PayloadAction<string | undefined>,
    ) => {
      state.selectedFileId = payload;
    },
    deleteFile: (
      state,
      _state: PayloadAction<{ id: string; sourcesFolderId: string }>,
    ) => state,
    deleteFileSuccess: (state, { payload }: PayloadAction<{ id: string }>) => {
      state.filesContent = state.filesContent.filter(
        (file) => file.id !== payload.id,
      );
    },
    updateFileContent: (
      state,
      _action: PayloadAction<{ id: string; content: string }>,
    ) => state,
    updateFileContentSuccess: (
      state,
      { payload }: PayloadAction<{ id: string; content: string }>,
    ) => {
      state.filesContent = state.filesContent.map((file) => {
        if (file.id === payload.id) {
          return {
            ...file,
            content: payload.content,
            modifiedContent: undefined,
            modified: false,
          };
        }

        return file;
      });
    },
  },
});

export const CodeEditorActions = codeEditorSlice.actions;
