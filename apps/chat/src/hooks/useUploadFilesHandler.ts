import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import {
  constructPath,
  getNextFileName,
  getRelativePath,
  prepareFileName,
  validatePreUploadFiles,
  validateUploadFiles,
} from '@/src/utils/app/file';
import { getFileRootId, isRootId } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { Translation } from '@/src/types/translation';

import { FilesActions, UIActions } from '@/src/store/actions';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

const validateFiles = (
  files: File[],
  allowedTypes: string[] = [],
): { validFiles: File[]; errorMsg: string } => {
  const { validFiles: preUploadValidFiles, errorMsg: preUploadErrorMsg } =
    validatePreUploadFiles(files, allowedTypes);
  const { validFiles, errorMsg: uploadErrorMsg } =
    validateUploadFiles(preUploadValidFiles);

  return {
    validFiles,
    errorMsg: [preUploadErrorMsg, uploadErrorMsg].join('\n').trim(),
  };
};

export const useUploadFilesHandler = (
  folderId: string,
  maximumAttachmentsAmount = 0,
  allowedTypes: string[] = [],
) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const allFiles = useAppSelector(FilesSelectors.selectFiles);
  const attachments = useAppSelector(FilesSelectors.selectSelectedFiles);

  const { bucket } = useMemo(
    () =>
      folderId
        ? splitEntityId(folderId)
        : { bucket: BucketService.getBucket() },
    [folderId],
  );

  const folderPath = getRelativePath(folderId);

  useEffect(() => {
    if (folderId && !isRootId(folderId)) {
      dispatch(FilesActions.getFiles({ id: folderId }));
    }
  }, [dispatch, folderId]);

  const handleUpload = useCallback(
    (files: File[]) => {
      const attachmentsAmount = attachments.length + files.length;
      if (attachmentsAmount > maximumAttachmentsAmount) {
        dispatch(
          UIActions.showErrorToast(
            t(
              `Maximum allowed attachments number is {{maxAttachmentsAmount}}. With your uploading amount will be {{attachmentsAmount}}`,
              {
                maxAttachmentsAmount: maximumAttachmentsAmount,
                attachmentsAmount,
              },
            ),
          ),
        );
        return;
      }

      const { validFiles, errorMsg } = validateFiles(files, allowedTypes);

      if (errorMsg) dispatch(UIActions.showErrorToast(errorMsg));
      if (!validFiles?.length) return;

      const attachmentsSameLevelNames = allFiles
        .filter((file) => file.folderId === folderId)
        .map((file) => prepareFileName(file.name));

      const preparedFiles = validFiles.map((file) => {
        const name = prepareFileName(
          attachmentsSameLevelNames.includes(prepareFileName(file.name))
            ? getNextFileName(file.name, allFiles)
            : file.name,
        );
        return {
          name,
          fileContent: file,
          id: constructPath(getFileRootId(bucket), folderPath, name),
        };
      });

      preparedFiles.forEach((file) => {
        dispatch(
          FilesActions.uploadFile({
            fileContent: file.fileContent,
            id: file.id,
            relativePath: folderPath,
            name: file.name,
          }),
        );
      });
      dispatch(
        FilesActions.selectFiles({ ids: preparedFiles.map(({ id }) => id) }),
      );
    },
    [
      allFiles,
      allowedTypes,
      attachments.length,
      bucket,
      dispatch,
      folderId,
      folderPath,
      maximumAttachmentsAmount,
      t,
    ],
  );

  return handleUpload;
};
