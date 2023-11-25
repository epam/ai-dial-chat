import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconTrashX,
  IconUserShare,
} from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import { Prompt } from '@/src/types/prompt';
import { DisplayMenuItemProps } from '@/src/types/sidebar';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

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
  const { t } = useTranslation('promptbar');
  const dispatch = useAppDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const allItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: 'Share by me',
        display:
          enabledFeatures.has(Feature.PromptsSharing) &&
          allPrompts.filter((c) => c.isShared).length > 0,
        dataQa: 'share-by-me',
        Icon: IconUserShare,
        onClick: () => {
          setIsOpen(false);
        }, //TODO
      },
      {
        name: 'Delete all prompts',
        display: allPrompts.length > 0,
        dataQa: 'delete-prompts',
        Icon: IconTrashX,
        onClick: () => {
          setIsOpen(true);
        },
      },
      {
        name: 'Import prompts',
        display: true,
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
        name: 'Export prompts',
        display: true,
        dataQa: 'export-prompts',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(PromptsActions.exportPrompts());
        },
      },
      {
        name: 'Create new folder',
        display: true,
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
        menuItems={allItems}
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
};
