import {
  BackendEntity,
  BackendFolder,
  BaseDialEntity,
} from '@/src/types/common';

import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '@/src/constants/folders';

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
    isRootSharedItem?: boolean;
    isFromDeviceAttachment?: boolean;
  } & ShareEntity;

// For file folders folderId is relative path and id is relative path + '/' + name
export type FileFolderInterface = FolderInterface & {
  absolutePath?: string;
  relativePath?: string;
};

export type FileFolderAttachment = FileFolderInterface & {
  contentType: typeof FOLDER_ATTACHMENT_CONTENT_TYPE;
};

export interface DialLink {
  title?: string;
  href: string;
}

export enum FileSourceType {
  MY_FILES = 'MY_FILES',
  REVIEW_FILES = 'REVIEW_FILES',
  SHARED_WITH_ME = 'SHARED_WITH_ME',
  PUBLIC = 'PUBLIC',
}

export enum FileValidationErrors {
  IncorrectSize = 'incorrectSize',
  IncorrectType = 'incorrectType',
  IncorrectName = 'incorrectName',
}

export interface OperationData<T> {
  index: number;
  data: T;
}

export interface OperationDataError<T> extends OperationData<T> {
  error: string;
}

export interface FileOperationsResult<T> {
  success: boolean;
  succeeded: number;
  failed: number;
  total: number;
  results: OperationData<T>[];
  errors?: OperationDataError<T>[];
}
