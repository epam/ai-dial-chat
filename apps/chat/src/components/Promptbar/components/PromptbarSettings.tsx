import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconSquareCheck,
  IconSquareOff,
  IconTrashX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getPromptRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { PromptsHistory } from '@/src/types/import-export';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { PINNED_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

export function PromptbarSettings() {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const isMyItemsExist = useAppSelector(
    PromptsSelectors.selectDoesAnyMyItemExist,
  );
  const isSelectMode = useAppSelector(PromptsSelectors.selectIsSelectMode);
  const collapsedSections = useAppSelector((state) =>
    UISelectors.selectCollapsedSections(state, FeatureType.Prompt),
  );

  const deleteTerm = isSelectMode ? 'selected' : 'all';

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Select all'),
        dataQa: 'select-all',
        Icon: IconSquareCheck,
        onClick: () => {
          dispatch(PromptsActions.setAllChosenPrompts());
        },
        display: isMyItemsExist,
      },
      {
        name: t('Unselect all'),
        dataQa: 'unselect-all',
        Icon: IconSquareOff,
        onClick: () => {
          dispatch(PromptsActions.resetChosenPrompts());
        },
        display: isSelectMode,
      },
      {
        name: t('Create new folder'),
        dataQa: 'create-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(
            UIActions.setCollapsedSections({
              featureType: FeatureType.Prompt,
              collapsedSections: collapsedSections.filter(
                (section) => section !== PINNED_PROMPTS_SECTION_NAME,
              ),
            }),
          );
          dispatch(
            PromptsActions.createFolder({
              parentId: getPromptRootId(),
            }),
          );
        },
        display: !isSelectMode,
      },
      {
        name: t('Import prompts'),
        onClick: (promptsJSON: unknown) => {
          const typedJson = promptsJSON as { content: unknown };
          dispatch(
            ImportExportActions.importPrompts({
              promptsHistory: typedJson.content as PromptsHistory,
            }),
          );
        },
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
        display: !isSelectMode,
      },
      {
        display: isMyItemsExist && !isSelectMode,
        name: t('Export prompts'),
        dataQa: 'export',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(ImportExportActions.exportPrompts());
        },
      },
      {
        name: t(`Delete ${deleteTerm} prompts`),
        display: isMyItemsExist,
        dataQa: 'delete-entities',
        Icon: IconTrashX,
        onClick: () => {
          setIsClearModalOpen(true);
        },
      },
    ],
    [collapsedSections, deleteTerm, dispatch, isMyItemsExist, isSelectMode, t],
  );

  return (
    <>
      <SidebarMenu menuItems={menuItems} featureType={FeatureType.Prompt} />

      <ConfirmDialog
        isOpen={isClearModalOpen}
        heading={t(`Confirm deleting ${deleteTerm} prompts`)}
        description={
          t(`Are you sure that you want to delete ${deleteTerm} prompts?`) || ''
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsClearModalOpen(false);
          if (result) {
            if (!isSelectMode) {
              dispatch(PromptsActions.clearPrompts());
            } else {
              dispatch(PromptsActions.deleteChosenPrompts());
            }
          }
        }}
      />
    </>
  );
}
