import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconTrashX,
} from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

interface PromptbarSettingsProps {
  allPrompts: Prompt[];
}
export const PromptbarSettings: FC<PromptbarSettingsProps> = ({
  allPrompts,
}) => {
  const { t } = useTranslation(Translation.PromptBar);
  const dispatch = useAppDispatch();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const folders = useAppSelector(PromptsSelectors.selectFolders);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Create new folder'),
        dataQa: 'create-prompt-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(PromptsActions.createFolder());
        },
      },
      {
        name: t('Import prompts'),
        onClick: (promptsJSON) => {
          dispatch(
            PromptsActions.importPrompts({ promptsHistory: promptsJSON }),
          );
        },
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
      },
      {
        display: allPrompts.length > 0 || folders.length > 0,
        name: t('Export prompts'),
        dataQa: 'export-prompts',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(PromptsActions.exportPrompts());
        },
      },
      {
        name: t('Delete all'),
        display: allPrompts.length > 0 || folders.length > 0,
        dataQa: 'delete-prompts',
        Icon: IconTrashX,
        onClick: () => {
          setIsClearModalOpen(true);
        },
      },
    ],
    [allPrompts.length, dispatch, folders.length, t],
  );

  return (
    <>
      <SidebarMenu
        menuItems={menuItems}
        highlightColor={HighlightColor.Violet}
      />

      <ConfirmDialog
        isOpen={isClearModalOpen}
        heading={t('Confirm clearing all prompts')}
        description={
          t('Are you sure that you want to delete all prompts?') || ''
        }
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsClearModalOpen(false);
          if (result) {
            dispatch(PromptsActions.clearPrompts());
          }
        }}
      />
    </>
  );
};
