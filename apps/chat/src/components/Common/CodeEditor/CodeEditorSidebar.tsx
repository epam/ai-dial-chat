import {
  IconDeviceFloppy,
  IconFilePlus,
  IconUpload,
} from '@tabler/icons-react';
import { MouseEvent, useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getLastPathSegment } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';
import { isHiddenEntity } from '@/src/utils/app/search';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { CodeEditorActions, FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { CodeEditorSelectors, FilesSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { PreUploadDialog } from '@/src/components/Files/PreUploadModal';

import { CodeEditorFileTree } from './CodeEditorFileTree';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

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

  const modifiedFileIds = useAppSelector(
    CodeEditorSelectors.selectModifiedFileIds,
  );
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
      allFiles
        .filter((file) => !isHiddenEntity(file))
        .filter((file) => file.folderId === sourcesFolderId),
    [allFiles, sourcesFolderId],
  );

  const handleToggleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onToggle();
    },
    [onToggle],
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
      if (fileName) {
        dispatch(
          FilesActions.uploadFile({
            fileContent: new File([''], fileName, { type: 'text/plain' }),
            relativePath: getIdWithoutRootPathSegments(sourcesFolderId),
            id: constructPath(sourcesFolderId, fileName),
            name: fileName,
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

  const openUploadDialog = useCallback(() => {
    setUploadFolderId(sourcesFolderId);
    dispatch(FilesActions.getFolders({ id: parentPath }));
  }, [dispatch, parentPath, sourcesFolderId]);

  const handleUploadFiles = useCallback(
    (
      selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
      folderPath: string | undefined,
    ) => {
      selectedFiles.forEach((file) => {
        dispatch(
          FilesActions.uploadFile({
            fileContent: file.fileContent,
            id: file.id,
            relativePath: folderPath,
            name: file.name,
            bucket,
          }),
        );
      });
    },
    [bucket, dispatch],
  );

  const handleUploadFilesClose = useCallback(() => {
    setUploadFolderId(undefined);
  }, []);

  return (
    <div className="flex max-h-full flex-col divide-y divide-tertiary overflow-hidden rounded-l border border-tertiary bg-layer-3">
      <div className="flex w-fit shrink-0 border-r border-tertiary px-3 py-2">
        <DialGhostIconButton
          tooltipProps={{
            tooltip: t(ChatI18nKeys.HideFileList),
            isTriggerClickable: true,
          }}
          size={ElementSize.Small}
          onClick={handleToggleClick}
          icon={<MoveLeftIcon size={DEFAULT_ICON_SIZES.SMALL} />}
        />
      </div>
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
        <div className="flex items-center gap-3 px-3 py-2.5">
          <DialGhostIconButton
            tooltipProps={{ tooltip: t(ChatI18nKeys.AddNewFolderChat) }}
            size={ElementSize.Small}
            onClick={() =>
              dispatch(FilesActions.addNewFolder({ parentId: sourcesFolderId }))
            }
            icon={
              <FolderPlus
                width={DEFAULT_ICON_SIZES.SMALL}
                height={DEFAULT_ICON_SIZES.SMALL}
              />
            }
          />
          <DialGhostIconButton
            tooltipProps={{ tooltip: t(ChatI18nKeys.CreateFile) }}
            size={ElementSize.Small}
            onClick={handleCreateFile}
            disabled={!!newFileName}
            icon={<IconFilePlus size={DEFAULT_ICON_SIZES.SMALL} />}
          />
          <DialGhostIconButton
            tooltipProps={{ tooltip: t(ChatI18nKeys.UploadFile) }}
            size={ElementSize.Small}
            onClick={openUploadDialog}
            icon={<IconUpload size={DEFAULT_ICON_SIZES.SMALL} />}
          />
          {!!modifiedFileIds.length && (
            <DialGhostIconButton
              tooltipProps={{ tooltip: t(ChatI18nKeys.SaveAll) }}
              size={ElementSize.Small}
              onClick={() => handleSaveFiles(modifiedFileIds)}
              icon={<IconDeviceFloppy size={DEFAULT_ICON_SIZES.SMALL} />}
            />
          )}
        </div>
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
