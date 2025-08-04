import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.folders;

const selectTemporaryFolders = (state: RootState) =>
  rootSelector(state).temporaryFolders;

const selectNewAddedTemporaryFolderId = (state: RootState) =>
  rootSelector(state).newAddedTemporaryFolderId;

export const FoldersSelectors = {
  selectTemporaryFolders,
  selectNewAddedTemporaryFolderId,
};
