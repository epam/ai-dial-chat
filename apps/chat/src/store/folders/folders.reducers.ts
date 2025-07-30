import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  getFolderIdFromEntityId,
  renameFolderAndMoveEntity,
} from '@/src/utils/app/folders';
import { constructPath } from '@/src/utils/app/shared-utils';

import { FoldersState } from './folders.types';

import { TemporaryFolderInterface } from '@epam/ai-dial-shared';

const initialState: FoldersState = {
  temporaryFolders: [],
  newAddedTemporaryFolderId: '',
};

export const foldersSlice = createSlice({
  name: 'folders',
  initialState,
  reducers: {
    createTemporaryFolder: (
      state,
      { payload }: PayloadAction<Omit<TemporaryFolderInterface, 'temporary'>>,
    ) => {
      state.temporaryFolders.push({
        type: payload.type,
        id: payload.id,
        name: payload.name,
        folderId: payload.folderId,
        temporary: true,
      });

      state.newAddedTemporaryFolderId = payload.id;
    },
    deleteTemporaryFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string }>,
    ) => {
      state.temporaryFolders = state.temporaryFolders.filter(
        ({ id }) => id !== payload.folderId,
      );

      if (state.newAddedTemporaryFolderId === payload.folderId) {
        state.newAddedTemporaryFolderId = '';
      }
    },
    clearTemporaryFolders: (state) => {
      state.temporaryFolders = [];
      state.newAddedTemporaryFolderId = '';
    },
    renameTemporaryFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string; name: string }>,
    ) => {
      const parentId = getFolderIdFromEntityId(payload.folderId);
      const newId = constructPath(parentId, payload.name);

      state.temporaryFolders = state.temporaryFolders.map((f) =>
        renameFolderAndMoveEntity(f, payload.folderId, newId),
      );

      if (state.newAddedTemporaryFolderId === payload.folderId) {
        state.newAddedTemporaryFolderId = '';
      }
    },
    resetNewTemporaryFolderId: (state) => {
      state.newAddedTemporaryFolderId = '';
    },
  },
});

export const FoldersActions = foldersSlice.actions;
