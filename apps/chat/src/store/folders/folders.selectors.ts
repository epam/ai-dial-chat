import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.folders;

const selectTemporaryFolders = (state: RootState) =>
  rootSelector(state).temporaryFolders;

export const FoldersSelectors = {
  selectTemporaryFolders,
};
