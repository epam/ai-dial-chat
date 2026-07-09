import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getLastPathSegment, trimEndDots } from '@/src/utils/app/common';
import { constructPath, prepareFileName } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';
import {
  ResolvedUploadFile,
  dispatchPreparedFileUploads,
} from '@/src/utils/app/prepare-files-for-upload';
import { isHiddenEntity } from '@/src/utils/app/search';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { Translation } from '@/src/types/translation';

import { CodeEditorActions, FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { CodeEditorSelectors, FilesSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { PreUploadDialog } from '@/src/components/Files/PreUploadModal';

import { CodeEditorFileTree } from './CodeEditorFileTree';
import { CodeEditorSidebarFooter } from './CodeEditorSidebarFooter';
import { CodeEditorSidebarHeader } from './CodeEditorSidebarHeader';

const ALLOWED_PRE_UPLOAD_DIALOG_TYPES = ['*/*'];

interface CodeEditorSidebarProps {
  sourcesFolderId: string;
  readOnly?: boolean;
  reviewBucket?: string;
  onToggle: () => void;
}

export const CodeEditorSidebar = ({
  sourcesFolderId,
  readOnly,
  reviewBucket,
  onToggle,
}: CodeEditorSidebarProps) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const filesContent = useAppSelector(CodeEditorSelectors.selectFilesContent);
  const allFiles = useAppSelector(FilesSelectors.selectFiles);

  const [newFileFolder, setNewFileFolder] = useState<string>();
  const [newFileName, setNewFileName] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState<string>();
  const [deletingFileId, setDeletingFileId] = useState<string>();

  const { bucket, parentPath } = useMemo(
    () => splitEntityId(sourcesFolderId),
    [sourcesFolderId],
  );

  const rootFiles = useMemo(
    () =>
      allFiles.filter(
        (file) => !isHiddenEntity(file) && file.folderId === sourcesFolderId,
      ),
    [allFiles, sourcesFolderId],
  );

  const handleSaveFiles = useCallback(
    (fileIds: string[]) => {
      fileIds.forEach((id) => {
        const foundFile = filesContent.find((file) => file.id === id);
        if (foundFile && foundFile.modified) {
          dispatch(
            CodeEditorActions.updateFileContent({
              id,
              content: foundFile.modifiedContent ?? foundFile.content,
            }),
          );
        }
      });
    },
    [dispatch, filesContent],
  );

  const handleCreateFile = useCallback(() => {
    setNewFileFolder(sourcesFolderId);
    setNewFileName(getNextDefaultName('New file', rootFiles));
  }, [rootFiles, sourcesFolderId]);

  const handleUploadEmptyFile = useCallback(
    (fileName: string) => {
      const preparedFileName = trimEndDots(prepareFileName(fileName));

      if (preparedFileName) {
        dispatch(
          FilesActions.uploadFile({
            fileContent: new File([''], preparedFileName, {
              type: 'text/plain',
            }),
            relativePath: getIdWithoutRootPathSegments(sourcesFolderId),
            id: constructPath(sourcesFolderId, preparedFileName),
            name: preparedFileName,
            bucket,
          }),
        );
        setNewFileFolder(undefined);
        setNewFileName('');
      }
    },
    [bucket, dispatch, sourcesFolderId],
  );

  const handleDeleteFile = useCallback(
    (confirmed: boolean) => {
      if (confirmed && deletingFileId) {
        dispatch(
          CodeEditorActions.deleteFile({ id: deletingFileId, sourcesFolderId }),
        );
      }
      setDeletingFileId(undefined);
    },
    [deletingFileId, dispatch, sourcesFolderId],
  );

  const handleOpenUploadDialog = useCallback(() => {
    setUploadFolderId(sourcesFolderId);
    dispatch(FilesActions.getFolders({ id: parentPath }));
  }, [dispatch, parentPath, sourcesFolderId]);

  const handleUploadFiles = useCallback(
    (selectedFiles: ResolvedUploadFile[], folderPath: string | undefined) => {
      dispatchPreparedFileUploads(dispatch, selectedFiles, folderPath, {
        bucket,
      });
    },
    [bucket, dispatch],
  );

  const handleUploadFilesClose = useCallback(() => {
    setUploadFolderId(undefined);
  }, []);

  return (
    <div className="flex max-h-full flex-col divide-y divide-tertiary overflow-hidden rounded-l border border-tertiary bg-layer-3">
      <CodeEditorSidebarHeader onToggle={onToggle} />
      <div className="flex grow flex-col gap-0.5 overflow-y-auto p-3">
        <CodeEditorFileTree
          sourcesFolderId={sourcesFolderId}
          readOnly={readOnly}
          newFileFolder={newFileFolder}
          newFileName={newFileName}
          onNewFileNameChange={setNewFileName}
          onConfirmNewFile={handleUploadEmptyFile}
          onCreateFile={handleCreateFile}
          onDeleteFile={setDeletingFileId}
          onSaveFiles={handleSaveFiles}
          onFileUpload={setUploadFolderId}
        />
      </div>
      {!readOnly && (
        <CodeEditorSidebarFooter
          sourcesFolderId={sourcesFolderId}
          newFileName={newFileName}
          onCreateFile={handleCreateFile}
          onOpenUploadDialog={handleOpenUploadDialog}
          onSaveFiles={handleSaveFiles}
        />
      )}
      {uploadFolderId && (
        <PreUploadDialog
          uploadFolderId={uploadFolderId}
          isOpen
          allowedTypes={ALLOWED_PRE_UPLOAD_DIALOG_TYPES}
          initialFilesSelect
          onUploadFiles={handleUploadFiles}
          onClose={handleUploadFilesClose}
          maximumAttachmentsAmount={Number.MAX_SAFE_INTEGER}
          rootFolderId={sourcesFolderId}
          reviewBucket={reviewBucket}
        />
      )}
      <ConfirmDialog
        isOpen={!!deletingFileId}
        heading={t(ChatI18nKeys.ConfirmDeletingFile)}
        description={t(ChatI18nKeys.AreYouSureDeletePermanently, {
          name: getLastPathSegment(deletingFileId ?? ''),
        })}
        confirmLabel={t(ChatI18nKeys.Confirm)}
        cancelLabel={t(ChatI18nKeys.Cancel)}
        onClose={handleDeleteFile}
      />
    </div>
  );
};
