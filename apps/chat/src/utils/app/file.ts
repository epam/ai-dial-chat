import { TFunction } from 'next-i18next';

import { BucketService } from '@/src/utils/app/data/bucket-service';

import { Conversation } from '@/src/types/chat';
import { DialFile, DialLink, FileFolderAttachment } from '@/src/types/files';
import { FolderInterface, FolderType } from '@/src/types/folder';

import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '@/src/constants/folders';

import { ApiUtils } from '../server/api';
import { doesHaveDotsInTheEnd } from './common';
import { getPathToFolderById, splitEntityId } from './folders';
import { isFolderId } from './id';

import { Attachment, UploadStatus } from '@epam/ai-dial-shared';
import escapeRegExp from 'lodash-es/escapeRegExp';
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
  files?: Pick<DialFile, 'contentType' | 'absolutePath' | 'name' | 'status'>[],
  folders?: FolderInterface[],
  links?: DialLink[],
): { attachments: Attachment[] } | undefined => {
  if (!files?.length && !links?.length && !folders?.length) {
    return undefined;
  }

  const filesAttachments: Attachment[] | undefined = files
    ?.filter(
      (file) =>
        file.status !== UploadStatus.FAILED &&
        file.status !== UploadStatus.LOADING,
    )
    .map(
      (file): Attachment => ({
        type: file.contentType,
        title: file.name,
        url: ApiUtils.encodeApiUrl(`${file.absolutePath}/${file.name}`),
      }),
    );

  const folderAttachments: Attachment[] | undefined = folders?.map(
    (folder: FolderInterface) => ({
      type: FOLDER_ATTACHMENT_CONTENT_TYPE,
      title: folder.name ?? folder.id,
      url: !folder.id.startsWith('metadata/')
        ? `metadata/${ApiUtils.encodeApiUrl(`${folder.id}`)}/`
        : folder.id,
    }),
  );

  const linksAttachments: Attachment[] | undefined = links?.map(
    (link): Attachment => ({
      title: link.title ?? link.href,
      type: '*/*',
      url: link.href,
      reference_url: link.href,
    }),
  );

  return {
    attachments: (
      [folderAttachments, filesAttachments, linksAttachments].filter(
        Boolean,
      ) as Attachment[][]
    ).flat(),
  };
};

export const isAllowedMimeType = (
  allowedMimeTypes: string[],
  resourceMimeType: string,
) => {
  if (allowedMimeTypes.includes('*/*')) {
    return true;
  }

  const [resourceSubset, resourceTypeName] = resourceMimeType
    .toLowerCase()
    .split('/');

  return allowedMimeTypes.some((allowedMimeType) => {
    const [subset, name] = allowedMimeType.toLowerCase().split('/');

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
export const notAllowedSymbols = ':;,=/{}%&\\"';
export const notAllowedSymbolsRegex = new RegExp(
  `[${escapeRegExp(notAllowedSymbols)}]|(\r\n|\n|\r|\t)|[\x00-\x1F]`,
  'gm',
);
export const getFilesWithInvalidFileName = <T extends { name: string }>(
  files: T[],
): { filesWithNotAllowedSymbols: T[]; filesWithDotInTheEnd: T[] } => ({
  filesWithNotAllowedSymbols: files.filter(({ name }) =>
    name.match(notAllowedSymbolsRegex),
  ),
  filesWithDotInTheEnd: files.filter(({ name }) => doesHaveDotsInTheEnd(name)),
});

export const getFilesWithInvalidFileSize = (
  files: File[],
  sizeLimit: number,
): File[] => {
  return files.filter((file) => file.size > sizeLimit);
};

const parseAttachmentUrl = (url: string) => {
  const decodedUrl = ApiUtils.decodeApiUrl(url);
  const lastIndexSlash = decodedUrl.lastIndexOf('/');

  return {
    absolutePath: decodedUrl.slice(0, lastIndexSlash),
    name: decodedUrl.slice(lastIndexSlash + 1),
  };
};

export const isAttachmentLink = (url: string): boolean => isAbsoluteUrl(url);

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
        isAttachmentLink(attachment.url) ||
        isFolderId(attachment.url)
      ) {
        return null;
      }

      const { absolutePath, name } = parseAttachmentUrl(attachment.url);

      return {
        id: attachment.url,
        name,
        contentType: attachment.type,
        folderId: absolutePath,
        absolutePath,
      };
    })
    .filter(Boolean) as Omit<DialFile, 'contentLength'>[];
};

export const getDialFoldersFromAttachments = (
  attachments: Attachment[] | undefined,
): FileFolderAttachment[] => {
  if (!attachments) {
    return [];
  }

  return attachments
    .map((attachment): FileFolderAttachment | null => {
      if (
        !attachment.url ||
        isAttachmentLink(attachment.url) ||
        !isFolderId(attachment.url)
      ) {
        return null;
      }

      const { absolutePath, name } = parseAttachmentUrl(attachment.url);

      return {
        id: attachment.url,
        type: FolderType.File,
        contentType: FOLDER_ATTACHMENT_CONTENT_TYPE,
        name,
        folderId: absolutePath,
        absolutePath,
      };
    })
    .filter(Boolean) as FileFolderAttachment[];
};

export const getDialLinksFromAttachments = (
  attachments: Attachment[] | undefined,
): DialLink[] => {
  if (!attachments) {
    return [];
  }

  return attachments
    .map((attachment): DialLink | null => {
      if (!attachment.url || !isAttachmentLink(attachment.url)) {
        return null;
      }

      return {
        href: attachment.url,
        title: attachment.title,
      };
    })
    .filter(Boolean) as DialLink[];
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

export const getShortExtensionsListFromMimeType = (
  mimeTypes: string[],
  t: TFunction,
) => {
  return mimeTypes
    .map((mimeType) => {
      if (mimeType.endsWith('/*')) {
        return t(mimeType.replace('/*', 's'));
      }

      return getExtensionsListForMimeType(mimeType)
        .flat()
        .map((type) => `.${type}`);
    })
    .flat();
};

export const getFileNameWithoutExtension = (filename: string) =>
  filename.lastIndexOf('.') > 0
    ? filename.slice(0, filename.lastIndexOf('.'))
    : filename;

export const getFileNameExtension = (filename: string) =>
  filename.lastIndexOf('.') > 0
    ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
    : '';

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

export const getNextFileName = (
  defaultName: string,
  files: DialFile[],
  index = 0,
  startWithEmptyPostfix = false,
  parentFolderId?: string,
): string => {
  const defaultFileName = getFileNameWithoutExtension(defaultName);
  const defaultFileExtension = getFileNameExtension(defaultName);
  const prefix = `${defaultFileName} `;
  const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);

  if (!files.length) {
    return !startWithEmptyPostfix ? `${prefix}${1 + index}` : defaultName;
  }

  const maxNumber =
    Math.max(
      ...files
        .filter(
          (file) =>
            file.name === defaultName ||
            (getFileNameExtension(file.name) === defaultFileExtension &&
              getFileNameWithoutExtension(file.name).match(regex) &&
              (parentFolderId ? file.folderId === parentFolderId : true)),
        )
        .map((file) => {
          return (
            parseInt(
              `${getFileNameWithoutExtension(file.name).replace(defaultFileName, '')}`,
              10,
            ) || (startWithEmptyPostfix ? 0 : 1)
          );
        }),
      startWithEmptyPostfix ? -1 : 0,
    ) + index; // max number

  if (maxNumber >= 9999999) {
    return getNextFileName(
      `${prefix}${maxNumber}${defaultFileExtension}`,
      files,
      index,
      startWithEmptyPostfix,
    );
  }

  if (startWithEmptyPostfix && maxNumber === -1) {
    return defaultName;
  }

  return `${prefix}${maxNumber + 1}${defaultFileExtension}`;
};

export const prepareFileName = (filename: string) =>
  `${getFileNameWithoutExtension(filename)}${getFileNameExtension(filename)}`;

export const isAbsoluteUrl = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  return [
    'data:',
    '//',
    'http://',
    'https://',
    'file://',
    'ftp://',
    'mailto:',
    'telnet://',
    'api/files',
  ].some((prefix) => urlLower.startsWith(prefix));
};

export const getDownloadPath = (file: DialFile) =>
  file.absolutePath ? constructPath(file.absolutePath, file.name) : file.id;

export const isConversationHasExternalAttachments = (
  conversation: Conversation,
): boolean => {
  const userBucket = BucketService.getBucket();
  const messages =
    conversation.playback?.messagesStack ?? conversation.isReplay
      ? [
          ...(conversation.replay?.replayUserMessagesStack ?? []),
          ...conversation.messages,
        ]
      : conversation.messages;

  const attachments = messages
    .flatMap((message) => message.custom_content?.attachments ?? [])
    .filter(
      (attachment) => attachment.url && !isAttachmentLink(attachment.url),
    );

  return attachments.some((attachment) => {
    const { bucket: attachmentBucket } = splitEntityId(
      attachment.url as string,
    );

    return attachmentBucket !== userBucket;
  });
};

export const validateMimeFormat = (type: string) => {
  const reg = new RegExp(
    '^([a-zA-Z0-9!*\\-.+]+|\\*)\\/([a-zA-Z0-9!*\\-.+]+|\\*)$',
  );

  return reg.test(type);
};
