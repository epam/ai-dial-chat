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
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

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
  selectedAttachmentsAmount = 0,
  maximumAttachmentsAmount = 0,
  allowedTypes: string[] = [],
  skipSelect?: boolean,
) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const allFiles = useAppSelector(FilesSelectors.selectFiles);

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
      const attachmentsAmount = selectedAttachmentsAmount + files.length;
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

      const sameLevelFiles = allFiles.filter(
        (file) => file.folderId === folderId,
      );
      const sameLevelFileNames = new Set(
        sameLevelFiles.map((file) => prepareFileName(file.name)),
      );

      const preparedFiles = validFiles.map((file) => {
        let name = prepareFileName(file.name);

        if (sameLevelFileNames.has(name)) {
          name = getNextFileName(name, sameLevelFiles, 0, true);
          sameLevelFileNames.add(name);
        }

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

            showSuccessMessage: true,
          }),
        );
      });
      if (!skipSelect) {
        dispatch(
          FilesActions.selectFiles({ ids: preparedFiles.map(({ id }) => id) }),
        );
      }

      return Promise.resolve(preparedFiles);
    },
    [
      allFiles,
      allowedTypes,
      selectedAttachmentsAmount,
      bucket,
      dispatch,
      folderId,
      folderPath,
      maximumAttachmentsAmount,
      t,
      skipSelect,
    ],
  );

  return handleUpload;
};
