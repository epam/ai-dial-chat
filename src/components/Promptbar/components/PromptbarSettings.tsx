import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconTrashX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

export function PromptbarSettings() {
  const { t } = useTranslation(Translation.PromptBar);

  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const dispatch = useAppDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Delete all prompts'),
        display: allPrompts.length > 0,
        dataQa: 'delete-prompts',
        Icon: IconTrashX,
        onClick: () => {
          setIsOpen(true);
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
        name: t('Export prompts'),
        dataQa: 'export-prompts',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(PromptsActions.exportPrompts());
        },
      },
      {
        name: t('Create new folder'),
        dataQa: 'create-prompt-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(PromptsActions.createFolder({ name: t('New folder') }));
        },
      },
    ],
    [allPrompts, dispatch, enabledFeatures, t],
  );

  return (
    <>
      <SidebarMenu
        menuItems={menuItems}
        highlightColor={HighlightColor.Violet}
      />

      <ConfirmDialog
        isOpen={isOpen}
        heading={t('Confirm clearing all prompts')}
        description={
          t('Are you sure that you want to delete all prompts?') || ''
        }
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsOpen(false);
          if (result) {
            dispatch(PromptsActions.clearPrompts());
          }
        }}
      />
    </>
  );
}
