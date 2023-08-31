import { FolderInterface } from '@/types/folder';

export const saveConversationsFolders = (folders: FolderInterface[]) => {
  localStorage.setItem('conversationFolders', JSON.stringify(folders));
};
export const savePromptsFolders = (folders: FolderInterface[]) => {
  localStorage.setItem('promptsFolders', JSON.stringify(folders));
};
