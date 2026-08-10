import { BucketService } from '@/src/utils/app/data/bucket-service';
import { getResourceMaxSegmentBytes } from '@/src/utils/app/resource-limits';
import {
  isFolderId,
  isMyEntity,
  splitEntityId,
} from '@/src/utils/app/shared-utils';
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
import { Translation } from '@/src/types/translation';

import {
  ALL_FILE_EXTENSIONS,
  BYTES_IN_KB,
  BYTES_IN_MB,
  FALLBACK_CONTENT_TYPE,
  MAX_FILE_SIZE_IN_BYTES,
  TEMP_FILE_NAME_IN_FILE_MANAGER,
} from '@/src/constants/file';
import {
  FOLDER_ATTACHMENT_CONTENT_TYPE,
  METADATA_PREFIX,
} from '@/src/constants/folders';
import { ChatI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import {
  addTrailingSlashIfAbsent,
  doesHaveDotsInTheEnd,
  getUtf8BytesLength,
  prepareEntityName,
} from './common';

import { Attachment, UploadStatus } from '@epam/ai-dial-shared';
import {
  NOT_ALLOWED_SPACES,
  NOT_ALLOWED_SPACES_REGEXP,
  NOT_ALLOWED_SYMBOLS,
  NOT_ALLOWED_SYMBOLS_REGEXP,
} from '@epam/ai-dial-ui-kit';
import escapeRegExp from 'lodash-es/escapeRegExp';
import uniq from 'lodash-es/uniq';
import uniqBy from 'lodash-es/uniqBy';
import { lookup } from 'mime-types';

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

export function removeTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}

/** True if `path` equals `prefix` or is a strict descendant (`prefix/…`). Trailing slashes ignored. */
export function isPathUnderPrefix(path: string, prefix: string): boolean {
  const normalizedPath = removeTrailingSlash(path);
  const normalizedPrefix = removeTrailingSlash(prefix);
  if (!normalizedPath || !normalizedPrefix) {
    return false;
  }
  if (normalizedPath === normalizedPrefix) {
    return true;
  }
  return normalizedPath.startsWith(`${normalizedPrefix}/`);
}

export const getRelativePath = (
  absolutePath: string | undefined,
): string | undefined => {
  // 'HASH/files/folder-1/folder-2' -> folder-1/folder-2
  return absolutePath?.split('/').toSpliced(0, 2).join('/') || undefined;
};

export const getFileName = (path: string | undefined): string | undefined => {
  return path?.split('/').slice(-1)?.[0] || undefined;
};

export const getNestedEmptyFolderIdsForChosenParent = (
  emptyFolderIds: string[],
  parentFolderId: string,
): string[] => {
  const prefix = addTrailingSlashIfAbsent(parentFolderId);
  return emptyFolderIds
    .filter((id) => addTrailingSlashIfAbsent(id).startsWith(prefix))
    .map((id) => addTrailingSlashIfAbsent(id));
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
        (file) =>
          file.name !== TEMP_FILE_NAME_IN_FILE_MANAGER &&
          !isAllowedMimeType(allowedFileTypes, file.contentType),
      );
};

const isFileManagerPlaceholderLastSegment = (
  segment: string | undefined,
): boolean => {
  if (!segment) {
    return false;
  }
  return (
    segment === TEMP_FILE_NAME_IN_FILE_MANAGER ||
    segment.startsWith(TEMP_FILE_NAME_IN_FILE_MANAGER)
  );
};

const lastSegmentOrWhole = (value: string | undefined): string => {
  if (value === undefined || value === '') {
    return '';
  }
  return getFileName(value) ?? value;
};

/**
 * Drops UI Kit FileManager folder markers from lists.
 * Matches exact `.dial_folder` or suffix variants (e.g. `.dial_folder__`) on the
 * last path segment of `name` and/or `id`.
 */
export function withoutFileManagerPlaceholderByName<
  T extends { name?: string; id?: string },
>(items: T[]): T[] {
  return items.filter((item) => {
    const nameTail = lastSegmentOrWhole(item.name);
    const idTail = lastSegmentOrWhole(item.id);
    return (
      !isFileManagerPlaceholderLastSegment(nameTail) &&
      !isFileManagerPlaceholderLastSegment(idTail)
    );
  });
}

export const getFilesWithInvalidFileType = (
  files: File[],
  allowedFileTypes: string[],
): File[] => {
  return allowedFileTypes.includes('*/*')
    ? []
    : files.filter(
        (file) => !isAllowedMimeType(allowedFileTypes, getFileMimeType(file)),
      );
};

// Regular expressions and restricted symbols from DIAL UI Kit
export const notAllowedSymbols = NOT_ALLOWED_SYMBOLS;
export const notAllowedSpaces = NOT_ALLOWED_SPACES;
export const notAllowedSymbolsRegex = new RegExp(
  NOT_ALLOWED_SYMBOLS_REGEXP.source,
  'gm',
);

export const notAllowedSpacesRegex = new RegExp(
  NOT_ALLOWED_SPACES_REGEXP.source,
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

export const parseAttachmentUrl = (url: string) => {
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
    return Object.entries(ALL_FILE_EXTENSIONS).reduce((acc, [key, value]) => {
      const [keySubset] = key.split('/');
      if (keySubset === subset) {
        acc.push(...value);
      }

      return acc;
    }, [] as string[]);
  } else {
    return ALL_FILE_EXTENSIONS[mimeType] || [];
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

export const getFileNameWithoutExtension = (
  filename: string,
  options: { isExtensionIncluded?: boolean } = { isExtensionIncluded: true },
) => {
  const index = filename.lastIndexOf('.');
  if (index > 0) {
    return filename.slice(0, index);
  }

  return options?.isExtensionIncluded && index !== 0
    ? filename
    : index === -1 // -1 - in case when file without extension
      ? filename
      : '';
};

export const getFileNameExtension = (
  filename: string,
  options: { isExtensionIncluded?: boolean } = { isExtensionIncluded: false },
) => {
  if (filename.lastIndexOf('.') > 0) {
    return filename.slice(filename.lastIndexOf('.')).toLowerCase();
  }

  return options?.isExtensionIncluded && filename.lastIndexOf('.') === 0
    ? filename
    : '';
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

export const prepareFileName = (filename: string) => {
  const trimmedFilename = filename.trim();
  const extension = getFileNameExtension(trimmedFilename);

  if (!extension || extension === '.') {
    return prepareEntityName(trimmedFilename);
  }

  const maxBaseNameLength = Math.max(
    getResourceMaxSegmentBytes() - getUtf8BytesLength(extension),
    0,
  );
  const preparedBaseName = prepareEntityName(
    getFileNameWithoutExtension(trimmedFilename),
    {
      forRenaming: true,
      replaceWithSpacesForRenaming: true,
      maxNameLength: maxBaseNameLength,
    },
  );

  return `${preparedBaseName}${extension}`;
};

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

const SAFE_LINK_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'ftp:',
  'ftps:',
  'tel:',
]);

const URL_SCHEME_REGEX = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Tells whether a url is safe to put into an `href`. Relative urls (e.g. the
 * `api/files` proxy paths) carry no scheme and are safe; anything with a scheme
 * outside the allow list - `javascript:` above all - is not.
 */
export const isSafeLinkUrl = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }

  // Browsers ignore control characters while resolving a scheme, so drop them
  // before looking at it - otherwise "java\tscript:" would slip through.
  const normalizedUrl = Array.from(url)
    .filter((char) => char.charCodeAt(0) > 0x20)
    .join('');

  const scheme = URL_SCHEME_REGEX.exec(normalizedUrl);

  return !scheme || SAFE_LINK_PROTOCOLS.has(`${scheme[1].toLowerCase()}:`);
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

export const getMimeTypeByFileName = (filename: string): string => {
  const extension = getFileNameExtension(filename);
  return extension
    ? lookup(extension) || FALLBACK_CONTENT_TYPE
    : FALLBACK_CONTENT_TYPE;
};

export const getFileMimeType = (file: File): string => {
  return file.type || getMimeTypeByFileName(file.name);
};

export const getFileWithType = (file: File): File => {
  return new File([file], file.name, {
    type: getFileMimeType(file),
    lastModified: file.lastModified,
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
    if (!isAllowedMimeType(allowedTypes, getFileMimeType(file))) {
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
            ChatI18nKeys.MaxFileSizeUpTo512MbNextFilesHaventBeenUploaded,
            { ns: Translation.Chat, fileNames },
          );
        case FileValidationErrors.IncorrectType:
          return translate(ChatI18nKeys.TryingToUploadFilesWithIncorrectType, {
            ns: Translation.Chat,
            fileNames,
          });
        default:
          return '';
      }
    })
    .join('\n');

  return { validFiles, errorMsg };
};

export const validateUploadFiles = <T extends File | { name: string }>(
  files: T[],
): { validFiles: T[] } => {
  const validFiles: T[] = [];

  files.forEach((file) => {
    const sanitizedName = prepareEntityName(file.name, {
      forRenaming: true,
      trimEndDotsRequired: true,
    });

    if (file instanceof File) {
      const renamedFile = new File([file], sanitizedName, {
        type: getFileMimeType(file),
        lastModified: file.lastModified,
      });
      validFiles.push(renamedFile as T);
    } else {
      validFiles.push({
        ...file,
        name: sanitizedName,
      });
    }
  });

  return { validFiles };
};

export const getFilesFromDataTransferItems = (
  items: DataTransferItemList,
): File[] => {
  return Array.from(items)
    .filter((item) => item.webkitGetAsEntry()?.isFile)
    .map((item) => item.getAsFile()) as File[];
};

export const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes >= BYTES_IN_MB) {
    return `${Math.ceil(sizeInBytes / BYTES_IN_MB)} ${translate(ChatI18nKeys.MBUnit, { ns: Translation.Chat })}`;
  }

  return `${Math.ceil(sizeInBytes / BYTES_IN_KB)} ${translate(ChatI18nKeys.KBUnit, { ns: Translation.Chat })}`;
};

export const getMyBucketAttachments = (
  attachments: Attachment[],
): Attachment[] => {
  return attachments.filter((attachment) =>
    isMyEntity({ id: attachment.url ?? '' }),
  );
};

export const getRootFolderPlaceholderName = (bucket: string): string => {
  const userBucket = BucketService.getBucket();
  if (userBucket === bucket) {
    return translate(ChatI18nKeys.MyFiles, { ns: Translation.Chat });
  }
  if (bucket === PUBLIC_URL_PREFIX) {
    return translate(ChatI18nKeys.Organization, { ns: Translation.Chat });
  }

  return translate(ChatI18nKeys.SharedWithMeFiles, { ns: Translation.Chat });
};

export const getFilesAndFoldersFromUrls = (
  urls: string[],
  featureType: FeatureType,
  uploadStatus?: UploadStatus,
) => {
  const files: DialFile[] = [];
  const folders: FolderInterface[] = [];

  urls.forEach((url) => {
    const { absolutePath, name } = parseAttachmentUrl(url);

    files.push({
      id: url,
      name,
      contentType: getMimeTypeByFileName(name),
      folderId: absolutePath,
      absolutePath,
    } as DialFile);

    const {
      apiKey,
      bucket,
      name: folderName,
      parentPath,
    } = splitEntityId(absolutePath);

    folders.push({
      id: absolutePath,
      name: folderName,
      type: featureType,
      folderId: constructPath(apiKey, bucket, parentPath),
      status: uploadStatus,
    });
  });

  return {
    files: uniqBy(files, 'id'),
    folders: uniqBy(folders, 'id'),
  };
};
