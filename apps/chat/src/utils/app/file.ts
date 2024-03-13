import { Attachment, Conversation } from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';
import { DialFile, DialLink } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { ApiUtils } from '../server/api';
import { doesHaveDotsInTheEnd } from './common';
import { getPathToFolderById } from './folders';

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
  links?: DialLink[],
): { attachments: Attachment[] } | undefined => {
  if (!files?.length && !links?.length) {
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
      [filesAttachments, linksAttachments].filter(Boolean) as Attachment[][]
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
export const notAllowedSymbols = ':;,=/{}\\';
export const notAllowedSymbolsRegex = new RegExp(
  `[${escapeRegExp(notAllowedSymbols)}]|(\r\n|\n|\r)`,
  'gm',
);
export const getFilesWithInvalidFileName = <T extends { name: string }>(
  files: T[],
): T[] => {
  return files.filter(
    ({ name }) =>
      name.match(notAllowedSymbolsRegex) || doesHaveDotsInTheEnd(name),
  );
};

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
        id: attachment.url,
        name,
        contentType: attachment.type,
        folderId: absolutePath,
        absolutePath,
      };
    })
    .filter(Boolean) as Omit<DialFile, 'contentLength'>[];
};

export const getDialLinksFromAttachments = (
  attachments: Attachment[] | undefined,
): DialLink[] => {
  if (!attachments) {
    return [];
  }

  return attachments
    .map((attachment): DialLink | null => {
      if (
        !attachment.url ||
        (!attachment.url.startsWith('http') && !attachment.url.startsWith('//'))
      ) {
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
