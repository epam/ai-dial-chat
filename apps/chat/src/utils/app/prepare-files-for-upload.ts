import { prepareEntityName } from '@/src/utils/app/common';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import {
  constructPath,
  getFileMimeType,
  getRelativePath,
  prepareFileName,
  validatePreUploadFiles,
  validateUploadFiles,
} from '@/src/utils/app/file';
import { getFileRootId } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { updateAttachmentsNames } from '@/src/utils/app/zip-import-export';

import {
  MappedReplaceActions,
  ReplaceOptions,
} from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { HTTPMethod } from '@/src/types/http';
import type { AppDispatch } from '@/src/store';

import { FilesActions } from '@/src/store/actions';

export type PreparedUploadFile = Required<
  Pick<DialFile, 'fileContent' | 'id' | 'name'>
>;

export type ResolvedUploadFile = PreparedUploadFile & {
  httpMethod?: HTTPMethod;
};

export type PrepareFileUploadInput =
  | File
  | { fileContent: File; name: string };

const normalizeUploadInputs = (
  files: PrepareFileUploadInput[],
): File[] =>
  files.map((file) => {
    if (file instanceof File) {
      return file;
    }

    const { fileContent, name } = file;
    if (fileContent.name === name) {
      return fileContent;
    }

    return new File([fileContent], name, {
      type: getFileMimeType(fileContent),
      lastModified: fileContent.lastModified,
    });
  });

const validateFiles = (
  files: File[],
  allowedTypes: string[] = [],
): { validFiles: File[]; errorMsg: string } => {
  const sanitizedFiles = files.map((file) => {
    const cleanName = prepareEntityName(file.name);
    return file.name === cleanName
      ? file
      : new File([file], cleanName, {
          type: getFileMimeType(file),
          lastModified: file.lastModified,
        });
  });

  const { validFiles: preUploadValidFiles, errorMsg: preUploadErrorMsg } =
    validatePreUploadFiles(sanitizedFiles, allowedTypes);

  const { validFiles } = validateUploadFiles(preUploadValidFiles);

  return {
    validFiles,
    errorMsg: preUploadErrorMsg.trim(),
  };
};

export interface PrepareFilesForUploadParams {
  files: PrepareFileUploadInput[];
  folderId: string;
  existingFiles: DialFile[];
  bucket?: string;
  allowedTypes?: string[];
}

export const detectUploadFileConflicts = ({
  files,
  folderId,
  existingFiles,
  bucket: bucketOverride,
  allowedTypes = [],
}: PrepareFilesForUploadParams): {
  duplicatedFiles: DialFile[];
  nonDuplicatedFiles: PreparedUploadFile[];
  errorMsg: string;
} => {
  const normalizedFiles = normalizeUploadInputs(files);
  const { validFiles, errorMsg } = validateFiles(normalizedFiles, allowedTypes);

  if (!validFiles.length) {
    return { duplicatedFiles: [], nonDuplicatedFiles: [], errorMsg };
  }

  const { bucket } = bucketOverride
    ? { bucket: bucketOverride }
    : folderId
      ? splitEntityId(folderId)
      : { bucket: BucketService.getBucket() };

  const folderPath = getRelativePath(folderId);
  const sameLevelFiles = existingFiles.filter(
    (file) => file.folderId === folderId,
  );
  const sameLevelFileNames = new Set(
    sameLevelFiles.map((file) => prepareFileName(file.name)),
  );
  const batchNames = new Set<string>();

  const duplicatedFiles: DialFile[] = [];
  const nonDuplicatedFiles: PreparedUploadFile[] = [];

  validFiles.forEach((file) => {
    const name = prepareFileName(file.name);
    const id = constructPath(getFileRootId(bucket), folderPath, name);

    const conflictsWithExisting = sameLevelFileNames.has(name);
    const conflictsWithBatch = batchNames.has(name);

    if (conflictsWithExisting || conflictsWithBatch) {
      duplicatedFiles.push({
        id,
        name,
        folderId,
        fileContent: file,
        contentLength: file.size,
        contentType: getFileMimeType(file),
      } as DialFile);
    } else {
      nonDuplicatedFiles.push({
        name,
        fileContent: file,
        id,
      });
      batchNames.add(name);
      sameLevelFileNames.add(name);
    }
  });

  return { duplicatedFiles, nonDuplicatedFiles, errorMsg };
};

export const applyUploadReplaceActions = ({
  duplicatedFiles,
  nonDuplicatedFiles,
  mappedActions,
  existingFiles,
  folderId,
  bucket: bucketOverride,
}: {
  duplicatedFiles: DialFile[];
  nonDuplicatedFiles: PreparedUploadFile[];
  mappedActions: MappedReplaceActions;
  existingFiles: DialFile[];
  folderId: string;
  bucket?: string;
}): ResolvedUploadFile[] => {
  const { bucket } = bucketOverride
    ? { bucket: bucketOverride }
    : folderId
      ? splitEntityId(folderId)
      : { bucket: BucketService.getBucket() };

  const folderPath = getRelativePath(folderId);
  const sameLevelFiles = existingFiles.filter(
    (file) => file.folderId === folderId,
  );

  const attachmentsToPostfix: DialFile[] = [];
  const attachmentsToReplace: DialFile[] = [];

  duplicatedFiles.forEach((file) => {
    const action = mappedActions[file.id] ?? ReplaceOptions.Postfix;

    if (action === ReplaceOptions.Ignore) {
      return;
    }

    if (action === ReplaceOptions.Replace) {
      attachmentsToReplace.push(file);
      return;
    }

    attachmentsToPostfix.push(file);
  });

  const postfixResolved = updateAttachmentsNames({
    filesFromFolder: [...sameLevelFiles],
    attachmentsToPostfix,
  }).map((attachment) => ({
    id: constructPath(getFileRootId(bucket), folderPath, attachment.name),
    name: attachment.name,
    fileContent: attachment.fileContent!,
  }));

  const replaceResolved = attachmentsToReplace.map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    fileContent: attachment.fileContent!,
    httpMethod: HTTPMethod.PUT,
  }));

  return [...nonDuplicatedFiles, ...postfixResolved, ...replaceResolved];
};

export interface DispatchPreparedFileUploadsOptions {
  bucket?: string;
  showSuccessMessage?: boolean;
  selectFileIds?: boolean;
}

export const dispatchPreparedFileUploads = (
  dispatch: AppDispatch,
  preparedFiles: ResolvedUploadFile[],
  folderPath: string | undefined,
  {
    bucket,
    showSuccessMessage = false,
    selectFileIds = false,
  }: DispatchPreparedFileUploadsOptions = {},
): string[] => {
  const lastIndex = preparedFiles.length - 1;

  preparedFiles.forEach((file, index) => {
    dispatch(
      FilesActions.uploadFile({
        fileContent: file.fileContent,
        id: file.id,
        relativePath: folderPath,
        name: file.name,
        ...(bucket && { bucket }),
        ...(file.httpMethod && { httpMethod: file.httpMethod }),
        ...(showSuccessMessage && {
          showSuccessMessage: index === lastIndex,
        }),
      }),
    );
  });

  const ids = preparedFiles.map(({ id }) => id);

  if (selectFileIds && ids.length) {
    dispatch(FilesActions.selectFiles({ ids }));
  }

  return ids;
};
