import {
  BackendEntity,
  BackendFolder,
  BaseDialEntity,
} from '@/src/types/common';

import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '../constants/folders';

import { FolderInterface } from './folder';

import { MIMEType, ShareEntity } from '@epam/ai-dial-shared';

export interface BackendFile extends BackendEntity {
  contentLength: number;
  contentType: MIMEType;
}

export type BackendFileFolder = BackendFolder<BackendFile | BackendFileFolder>;

export type DialFile = Omit<
  BackendFile,
  'path' | 'nodeType' | 'resourceType' | 'bucket' | 'parentPath' | 'url'
> &
  BaseDialEntity & {
    percent?: number;
    fileContent?: File;
    isPublicationFile?: boolean;
  } & ShareEntity;

// For file folders folderId is relative path and id is relative path + '/' + name
export type FileFolderInterface = FolderInterface & {
  absolutePath?: string;
  relativePath?: string;
};

export type FileFolderAttachment = FileFolderInterface & {
  contentType: typeof FOLDER_ATTACHMENT_CONTENT_TYPE;
};

export type Status = undefined | 'LOADING' | 'LOADED' | 'FAILED';

export interface DialLink {
  title?: string;
  href: string;
}
