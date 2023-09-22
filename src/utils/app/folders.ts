import { FolderInterface } from '@/src/types/folder';

export const saveFolders = (folders: FolderInterface[]) => {
  localStorage.setItem('folders', JSON.stringify(folders));
};
