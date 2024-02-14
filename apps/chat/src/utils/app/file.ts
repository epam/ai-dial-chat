import { Attachment, Conversation } from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { decodeApiUrl, encodeApiUrl } from '../server/api';
import { getPathToFolderById } from './folders';

import escapeStringRegexp from 'escape-string-regexp';
import { extensions } from 'mime-types';

export function triggerDownload(url: string, name: string): void {
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const constructPath = (
  ...values: (string | undefined | null)[]
): string => {
  return values.filter(Boolean).join('/');
};

export const getRelativePath = (
  absolutePath: string | undefined,
): string | undefined => {
  // 'HASH/files/folder-1/folder-2' -> folder-1/folder-2
  return absolutePath?.split('/').toSpliced(0, 2).join('/') || undefined;
};

export const getFileName = (path: string | undefined): string | undefined => {
  return path?.split('/').slice(-1)?.[0] || undefined;
};

export const getUserCustomContent = (
  files: Pick<DialFile, 'contentType' | 'absolutePath' | 'name' | 'status'>[],
) => {
  if (files.length === 0) {
    return undefined;
  }

  return {
    attachments: files
      .filter(
        (file) =>
          file.status !== UploadStatus.FAILED &&
          file.status !== UploadStatus.LOADING,
      )
      .map((file) => ({
        type: file.contentType,
        title: file.name,
        url: encodeApiUrl(`${file.absolutePath}/${file.name}`),
      })),
  };
};

export const isAllowedMimeType = (
  allowedMimeTypes: string[],
  resourceMimeType: string,
) => {
  if (allowedMimeTypes.includes('*/*')) {
    return true;
  }

  const [resourceSubset, resourceTypeName] = resourceMimeType.split('/');

  return allowedMimeTypes.some((allowedMimeType) => {
    const [subset, name] = allowedMimeType.split('/');

    return (
      subset === resourceSubset && (name === '*' || name === resourceTypeName)
    );
  });
};

export const getDialFilesWithInvalidFileType = (
  files: DialFile[],
  allowedFileTypes: string[],
): DialFile[] => {
  return allowedFileTypes.includes('*/*')
    ? []
    : files.filter(
        (file) => !isAllowedMimeType(allowedFileTypes, file.contentType),
      );
};

export const getDialFilesWithInvalidFileSize = (
  files: DialFile[],
  sizeLimit: number,
): DialFile[] => {
  return files.filter((file) => file.contentLength > sizeLimit);
};

export const getFilesWithInvalidFileType = (
  files: File[],
  allowedFileTypes: string[],
): File[] => {
  return allowedFileTypes.includes('*/*')
    ? []
    : files.filter((file) => !isAllowedMimeType(allowedFileTypes, file.type));
};
export const notAllowedSymbols = ':;,=/';
export const notAllowedSymbolsRegex = new RegExp(
  `[${escapeStringRegexp(notAllowedSymbols)}]|(\r\n|\n|\r)`,
  'gm',
);
export const getFilesWithInvalidFileName = <T extends { name: string }>(
  files: T[],
): T[] => {
  return files.filter(({ name }) => name.match(notAllowedSymbolsRegex));
};

export const getFilesWithInvalidFileSize = (
  files: File[],
  sizeLimit: number,
): File[] => {
  return files.filter((file) => file.size > sizeLimit);
};

const parseAttachmentUrl = (url: string) => {
  const decodedUrl = decodeApiUrl(url);
  const lastIndexSlash = decodedUrl.lastIndexOf('/');

  return {
    absolutePath: decodedUrl.slice(0, lastIndexSlash),
    name: decodedUrl.slice(lastIndexSlash + 1),
  };
};

export const getDialFilesFromAttachments = (
  attachments: Attachment[] | undefined,
): Omit<DialFile, 'contentLength'>[] => {
  if (!attachments) {
    return [];
  }

  return attachments
    .map((attachment): Omit<DialFile, 'contentLength'> | null => {
      if (
        !attachment.url ||
        attachment.url.startsWith('http') ||
        attachment.url.startsWith('//')
      ) {
        return null;
      }

      const { absolutePath, name } = parseAttachmentUrl(attachment.url);

      return {
        id: absolutePath,
        name,
        contentType: attachment.type,
        folderId: absolutePath,
        absolutePath,
      };
    })
    .filter(Boolean) as Omit<DialFile, 'contentLength'>[];
};

export const getExtensionsListForMimeType = (mimeType: string) => {
  const [subset, name] = mimeType.split('/');

  if (subset === '*') {
    return ['all'];
  } else if (name === '*') {
    return Object.entries(extensions).reduce((acc, [key, value]) => {
      const [keySubset] = key.split('/');
      if (keySubset === subset) {
        acc.push(...value);
      }

      return acc;
    }, [] as string[]);
  } else {
    return extensions[mimeType] || [];
  }
};

export const getExtensionsListForMimeTypes = (mimeTypes: string[]) => {
  return mimeTypes
    .map((mimeType) => getExtensionsListForMimeType(mimeType))
    .flat()
    .map((type) => `.${type}`);
};

export const getFileNameWithoutExtension = (filename: string) =>
  filename.slice(0, filename.lastIndexOf('.'));

export const getFileNameExtension = (filename: string) =>
  filename.slice(filename.lastIndexOf('.'));

export const validatePublishingFileRenaming = (
  files: DialFile[],
  newName: string,
  renamingFile: DialFile,
) => {
  const fileWithSameName = files.find(
    (file) =>
      file.name === newName.trim() &&
      file !== renamingFile &&
      file.relativePath === renamingFile.relativePath,
  );

  if (fileWithSameName) {
    return 'Not allowed to have files with same names in one folder';
  }

  if (newName.match(notAllowedSymbolsRegex)) {
    return `The symbols ${notAllowedSymbols} are not allowed in file name`;
  }
};

export const renameAttachments = (
  conversation: Conversation,
  folderId: string | undefined,
  folders: FolderInterface[],
  filenameMapping: Map<string, string>,
): Conversation => {
  if (!filenameMapping.size) {
    return conversation;
  }

  const { path } = getPathToFolderById(folders, folderId);

  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      custom_content: message.custom_content && {
        ...message.custom_content,
        attachments: message.custom_content.attachments?.map(
          ({ title, ...attachment }) => ({
            ...attachment,
            title:
              getFileName(filenameMapping.get(constructPath(path, title))) ??
              title,
          }),
        ),
      },
    })),
  };
};
