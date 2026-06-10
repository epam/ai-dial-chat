import { prepareEntityName } from '@/src/utils/app/common';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import {
  constructPath,
  getFileMimeType,
  getNextFileName,
  getRelativePath,
  prepareFileName,
  validatePreUploadFiles,
  validateUploadFiles,
} from '@/src/utils/app/file';
import { getFileRootId } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { DialFile } from '@/src/types/files';
import type { AppDispatch } from '@/src/store';

import { FilesActions } from '@/src/store/actions';

export type PreparedUploadFile = Required<
  Pick<DialFile, 'fileContent' | 'id' | 'name'>
>;

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

export const prepareFilesForUpload = ({
  files,
  folderId,
  existingFiles,
  bucket: bucketOverride,
  allowedTypes = [],
}: PrepareFilesForUploadParams): {
  preparedFiles: PreparedUploadFile[];
  errorMsg: string;
} => {
  const normalizedFiles = normalizeUploadInputs(files);
  const { validFiles, errorMsg } = validateFiles(normalizedFiles, allowedTypes);

  if (!validFiles.length) {
    return { preparedFiles: [], errorMsg };
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
  const batchFiles: DialFile[] = [...sameLevelFiles];

  const preparedFiles = validFiles.map((file) => {
    let name = prepareFileName(file.name);

    if (sameLevelFileNames.has(name)) {
      name = getNextFileName(name, batchFiles, 0, true, folderId);
    }

    sameLevelFileNames.add(name);

    const preparedFile: PreparedUploadFile = {
      name,
      fileContent: file,
      id: constructPath(getFileRootId(bucket), folderPath, name),
    };

    batchFiles.push({
      id: preparedFile.id,
      name: preparedFile.name,
      folderId,
    } as DialFile);

    return preparedFile;
  });

  return { preparedFiles, errorMsg };
};

export interface DispatchPreparedFileUploadsOptions {
  bucket?: string;
  showSuccessMessage?: boolean;
  selectFileIds?: boolean;
}

export const dispatchPreparedFileUploads = (
  dispatch: AppDispatch,
  preparedFiles: PreparedUploadFile[],
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
