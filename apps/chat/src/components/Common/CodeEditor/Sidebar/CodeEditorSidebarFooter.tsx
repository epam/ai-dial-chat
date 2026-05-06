import {
  IconDeviceFloppy,
  IconFilePlus,
  IconUpload,
} from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { CodeEditorSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

interface CodeEditorSidebarFooterProps {
  sourcesFolderId: string;
  newFileName: string;
  onCreateFile: () => void;
  onOpenUploadDialog: () => void;
  onSaveFiles: (ids: string[]) => void;
}

export const CodeEditorSidebarFooter = ({
  sourcesFolderId,
  newFileName,
  onCreateFile,
  onOpenUploadDialog,
  onSaveFiles,
}: CodeEditorSidebarFooterProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const modifiedFileIds = useAppSelector(
    CodeEditorSelectors.selectModifiedFileIds,
  );

  return (
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
        onClick={onCreateFile}
        disabled={!!newFileName}
        icon={<IconFilePlus size={DEFAULT_ICON_SIZES.SMALL} />}
      />
      <DialGhostIconButton
        tooltipProps={{ tooltip: t(ChatI18nKeys.UploadFile) }}
        size={ElementSize.Small}
        onClick={onOpenUploadDialog}
        icon={<IconUpload size={DEFAULT_ICON_SIZES.SMALL} />}
      />
      {!!modifiedFileIds.length && (
        <DialGhostIconButton
          tooltipProps={{ tooltip: t(ChatI18nKeys.SaveAll) }}
          size={ElementSize.Small}
          onClick={() => onSaveFiles(modifiedFileIds)}
          icon={<IconDeviceFloppy size={DEFAULT_ICON_SIZES.SMALL} />}
        />
      )}
    </div>
  );
};
