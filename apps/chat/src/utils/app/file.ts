import { BucketService } from '@/src/utils/app/data/bucket-service';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import {
  DialFile,
  DialLink,
  FileFolderAttachment,
  FileValidationErrors,
} from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { MAX_FILE_SIZE_IN_BYTES } from '@/src/constants/file';
import {
  FOLDER_ATTACHMENT_CONTENT_TYPE,
  METADATA_PREFIX,
} from '@/src/constants/folders';

import { doesHaveDotsInTheEnd } from './common';
import { isFolderId } from './shared-utils';

import { Attachment, UploadStatus } from '@epam/ai-dial-shared';
import escapeRegExp from 'lodash-es/escapeRegExp';
import uniq from 'lodash-es/uniq';
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
  const path = values.filter(Boolean).join('/');
  return path.startsWith('api/') ? path.replace('api/', '/api/') : path;
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
      url: !folder.id.startsWith(METADATA_PREFIX)
        ? `${METADATA_PREFIX}${ApiUtils.encodeApiUrl(`${folder.id}`)}/`
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
export const doesHaveNotAllowedSymbols = (name: string) =>
  !!name.match(notAllowedSymbolsRegex);

export const getFilesWithInvalidFileName = <T extends { name: string }>(
  files: T[],
): { filesWithNotAllowedSymbols: T[]; filesWithDotInTheEnd: T[] } => ({
  filesWithNotAllowedSymbols: files.filter(({ name }) =>
    doesHaveNotAllowedSymbols(name),
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
        type: FeatureType.File,
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

export const getShortExtensionsListFromMimeType = (
  mimeTypes: string[],
  t: (key: string) => string,
) => {
  return uniq(
    mimeTypes
      .map((mimeType) => {
        if (mimeType.endsWith('/*')) {
          return t(mimeType.replace('/*', 's'));
        }

        return getExtensionsListForMimeType(mimeType)
          .flat()
          .map((type) => `.${type}`);
      })
      .flat(),
  );
};

export const getFileNameWithoutExtension = (filename: string) =>
  filename.lastIndexOf('.') > 0
    ? filename.slice(0, filename.lastIndexOf('.'))
    : filename;

export const getFileNameExtension = (filename: string) =>
  filename.lastIndexOf('.') > 0
    ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
    : '';

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
    (conversation.playback?.messagesStack ?? conversation.isReplay)
      ? [
          ...(conversation.replay?.replayUserMessagesStack ?? []),
          ...conversation.messages,
        ]
      : conversation.messages;

  const attachments = messages.flatMap(
    (message) => message.custom_content?.attachments ?? [],
  );

  const filesIds = getDialFilesFromAttachments(attachments);
  const folders = getDialFoldersFromAttachments(attachments);

  const entityIds = [...filesIds, ...folders].map(({ id }) =>
    id.startsWith(METADATA_PREFIX) ? id.slice(METADATA_PREFIX.length) : id,
  );

  return entityIds.some((id) => {
    const { bucket: attachmentBucket } = splitEntityId(id);

    return attachmentBucket !== userBucket;
  });
};

export const validatePreUploadFiles = (
  files: File[],
  allowedTypes: string[] = [],
): { validFiles: File[]; errorMsg: string } => {
  const validFiles: File[] = [];
  const byError: Partial<Record<FileValidationErrors, string[]>> = {};

  files.forEach((file) => {
    if (file.size > MAX_FILE_SIZE_IN_BYTES) {
      byError[FileValidationErrors.IncorrectSize] = [
        ...(byError[FileValidationErrors.IncorrectSize] ?? []),
        file.name,
      ];
      return;
    }
    if (!isAllowedMimeType(allowedTypes, file.type)) {
      byError[FileValidationErrors.IncorrectType] = [
        ...(byError[FileValidationErrors.IncorrectType] ?? []),
        file.name,
      ];
      return;
    }

    validFiles.push(file);
  });

  const errorMsg = Object.entries(byError)
    .map(([error, names]) => {
      const fileNames = names.join(', ');
      switch (error as FileValidationErrors) {
        case FileValidationErrors.IncorrectSize:
          return translate(
            "Max file size up to 512 Mb. Next files haven't been uploaded: {{fileNames}}",
            { fileNames },
          );
        case FileValidationErrors.IncorrectType:
          return translate(
            "You're trying to upload files with incorrect type: {{fileNames}}",
            { fileNames },
          );
        default:
          return '';
      }
    })
    .join('\n');

  return { validFiles, errorMsg };
};

const getIncorrectNamesError = (names: string[]) => {
  const isThereDotsAtTheEnd = names.some(doesHaveDotsInTheEnd);
  const isThereNotAllowedSymbols = names.some(doesHaveNotAllowedSymbols);
  const fileNames = names.join(', ');

  if (isThereDotsAtTheEnd && isThereNotAllowedSymbols)
    return translate(
      'The symbols {{notAllowedSymbols}} and a dot at the end are not allowed in file name. Please rename or delete them from uploading files list: {{fileNames}}',
      { notAllowedSymbols, fileNames },
    );

  if (isThereNotAllowedSymbols)
    return translate(
      'The symbols {{notAllowedSymbols}} are not allowed in file name. Please rename or delete them from uploading files list: {{fileNames}}',
      { notAllowedSymbols, fileNames },
    );

  return translate(
    'Using a dot at the end of a name is not permitted. Please rename or delete them from uploading files list: {{fileNames}}',
    { fileNames },
  );
};

export const validateUploadFiles = <T extends { name: string }>(
  files: T[],
): { validFiles: T[]; invalidFiles: T[]; errorMsg: string } => {
  const validFiles: T[] = [];
  const invalidFiles: T[] = [];
  const byError: Partial<Record<FileValidationErrors, string[]>> = {};

  files.forEach((file) => {
    if (
      doesHaveDotsInTheEnd(file.name) ||
      doesHaveNotAllowedSymbols(file.name)
    ) {
      byError[FileValidationErrors.IncorrectName] = [
        ...(byError[FileValidationErrors.IncorrectName] ?? []),
        file.name,
      ];
      invalidFiles.push(file);
      return;
    }

    validFiles.push(file);
  });

  const errorMsg = Object.entries(byError)
    .map(([error, names]) => {
      switch (error as FileValidationErrors) {
        case FileValidationErrors.IncorrectName:
          return getIncorrectNamesError(names);
        default:
          return '';
      }
    })
    .join('\n');

  return { validFiles, invalidFiles, errorMsg };
};

export const getFilesFromDataTransferItems = (
  items: DataTransferItemList,
): File[] => {
  return Array.from(items)
    .filter((item) => item.webkitGetAsEntry()?.isFile)
    .map((item) => item.getAsFile()) as File[];
};
