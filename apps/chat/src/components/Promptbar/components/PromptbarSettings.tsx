import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconTrashX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { PromptsHistory } from '@/src/types/importExport';
import { DisplayMenuItemProps } from '@/src/types/menu';
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

export function PromptbarSettings() {
  const { t } = useTranslation(Translation.PromptBar);

  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const dispatch = useAppDispatch();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const folders = useAppSelector(PromptsSelectors.selectFolders);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Create new folder'),
        dataQa: 'create-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(PromptsActions.createFolder());
        },
      },
      {
        name: t('Import prompts'),
        onClick: (promptsJSON: unknown) => {
          const typedJson = promptsJSON as { content: unknown };
          dispatch(
            PromptsActions.importPrompts({
              promptsHistory: typedJson.content as PromptsHistory,
            }),
          );
        },
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
      },
      {
        display: allPrompts.length > 0 || folders.length > 0,
        name: t('Export prompts'),
        dataQa: 'export',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(PromptsActions.exportPrompts());
        },
      },
      {
        name: t('Delete all'),
        display: allPrompts.length > 0 || folders.length > 0,
        dataQa: 'delete-entities',
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
      <SidebarMenu menuItems={menuItems} featureType={FeatureType.Prompt} />

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
}
