export interface Prompt {
  id: string;
  name: string;
  description?: string;
  content?: string;
  folderId?: string;
  isShared?: boolean;
  sharedWithMe?: boolean;
}
