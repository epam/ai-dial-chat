import {
  BackendEntity,
  BackendFolder,
  BaseDialEntity,
  ShareEntity,
} from '@/src/types/common';

import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '../constants/folders';

import { FolderInterface } from './folder';

export type ImageMIMEType = 'image/jpeg' | 'image/png' | string;

export type MIMEType =
  | 'text/markdown'
  | 'text/plain'
  | 'text/html'
  | ImageMIMEType
  | string;

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
  contentType: typeof FOLDER_ATTACHMENT_CONTENT_TYPE;
};

export type Status = undefined | 'LOADING' | 'LOADED' | 'FAILED';

export interface DialLink {
  title?: string;
  href: string;
}
