import { FolderInterface } from './folder';

export type ImageMIMEType = 'image/jpeg' | 'image/png' | string;

export type MIMEType =
  | 'text/markdown'
  | 'text/plain'
  | 'text/html'
  | ImageMIMEType
  | string;

export interface BackendFile {
  name: string;
  type: 'FILE';
  bucket: string;
  parentPath: string | null;
  contentLength: number;
  contentType: MIMEType;
}
export interface BackendFileFolder {
  name: string;
  type: 'FOLDER';
  path: string | undefined;
  files: (BackendFile | BackendFileFolder)[];
}

export type DialFile = Omit<
  BackendFile,
  'path' | 'type' | 'bucket' | 'parentPath'
> & {
  // Combination of relative path and name
  id: string;
  // Only for files fetched uploaded to backend
  // Same as relative path but has some absolute prefix like <HASH>
  absolutePath?: string;
  relativePath?: string;
  // Same as relative path, but needed for simplicity and backward compatibility
  folderId?: string;

  status?: 'UPLOADING' | 'FAILED';
  percent?: number;
  fileContent?: File;
  serverSynced?: boolean;
};

// For file folders folderId is relative path and id is relative path + '/' + name
export type FileFolderInterface = FolderInterface & {
  absolutePath?: string;
  relativePath?: string;
};
