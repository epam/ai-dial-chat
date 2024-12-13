import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconPaperclip,
  IconScale,
  IconSquareCheck,
  IconSquareOff,
  IconTrashX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getConversationRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { SupportedExportFormats } from '@/src/types/import-export';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { PINNED_CONVERSATIONS_SECTION_NAME } from '@/src/constants/sections';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { Feature } from '@epam/ai-dial-shared';

export const ChatbarSettings = () => {
  const { t } = useTranslation(Translation.SideBar);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const dispatch = useAppDispatch();

  const isStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const isMyItemsExist = useAppSelector(
    ConversationsSelectors.selectDoesAnyMyItemExist,
  );
  const isSelectMode = useAppSelector(
    ConversationsSelectors.selectIsSelectMode,
  );
  const collapsedSections = useAppSelector((state) =>
    UISelectors.selectCollapsedSections(state, FeatureType.Chat),
  );

  const handleToggleCompare = useCallback(() => {
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME, DEFAULT_CONVERSATION_NAME],
      }),
    );
  }, [dispatch]);

  const jsonImportHandler = useCallback(
    (jsonContent: SupportedExportFormats) => {
      dispatch(
        ImportExportActions.importConversations({
          data: jsonContent as SupportedExportFormats,
        }),
      );
    },
    [dispatch],
  );

  const zipImportHandler = useCallback(
    (zipFile: File) => {
      dispatch(ImportExportActions.importZipConversations({ zipFile }));
    },
    [dispatch],
  );

  const deleteTerm = isSelectMode ? 'selected' : 'all';

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Select all'),
        dataQa: 'select-all',
        Icon: IconSquareCheck,
        onClick: () => {
          dispatch(ConversationsActions.setAllChosenConversations());
        },
        display: isMyItemsExist,
        disabled: isStreaming,
      },
      {
        name: t('Unselect all'),
        dataQa: 'unselect-all',
        Icon: IconSquareOff,
        onClick: () => {
          dispatch(ConversationsActions.resetChosenConversations());
        },
        display: isSelectMode,
        disabled: isStreaming,
      },
      {
        name: t('Create new folder'),
        dataQa: 'create-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(
            UIActions.setCollapsedSections({
              featureType: FeatureType.Chat,
              collapsedSections: collapsedSections.filter(
                (section) => section !== PINNED_CONVERSATIONS_SECTION_NAME,
              ),
            }),
          );
          dispatch(
            ConversationsActions.createFolder({
              parentId: getConversationRootId(),
            }),
          );
        },
        display: !isSelectMode,
        disabled: isStreaming,
      },
      {
        name: t('Import conversations'),
        onClick: (importArgs: unknown) => {
          const typedArgs = importArgs as { content: unknown; zip?: boolean };

          if (!typedArgs.zip) {
            jsonImportHandler(typedArgs.content as SupportedExportFormats);
          }
          if (typedArgs.zip) {
            zipImportHandler(typedArgs.content as File);
          }
        },
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
        display: !isSelectMode,
        disabled: isStreaming,
      },
      {
        name: t('Export conversations without attachments'),
        dataQa: 'export',
        className: 'max-w-[158px]',
        Icon: IconFileArrowRight,
        display: isMyItemsExist && !isSelectMode,
        onClick: () => {
          dispatch(ImportExportActions.exportConversations());
        },
        disabled: isStreaming,
      },
      {
        name: t(`Delete ${deleteTerm} conversations`),
        display: isMyItemsExist,
        dataQa: 'delete-entities',
        Icon: IconTrashX,
        onClick: () => {
          setIsClearModalOpen(true);
        },
        disabled: isStreaming,
      },
      {
        name: t('Compare mode'),
        dataQa: 'compare',
        Icon: IconScale,
        disabled: isStreaming,
        onClick: () => {
          handleToggleCompare();
        },
        display: !isSelectMode,
      },
      {
        name: t('Attachments'),
        display:
          enabledFeatures.has(Feature.AttachmentsManager) && !isSelectMode,
        dataQa: 'attachments',
        Icon: IconPaperclip,
        disabled: isStreaming,
        onClick: () => {
          setIsSelectFilesDialogOpened(true);
        },
      },
    ],
    [
      t,
      isMyItemsExist,
      isStreaming,
      isSelectMode,
      deleteTerm,
      enabledFeatures,
      dispatch,
      collapsedSections,
      jsonImportHandler,
      zipImportHandler,
      handleToggleCompare,
    ],
  );

  return (
    <>
      <SidebarMenu menuItems={menuItems} featureType={FeatureType.Chat} />

      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={['*/*']}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={() => {
            setIsSelectFilesDialogOpened(false);
          }}
          headerLabel={t('Manage attachments')}
          forceShowSelectCheckBox
          forceHideSelectFolders
          showTooltip
        />
      )}

      <ConfirmDialog
        isOpen={isClearModalOpen}
        heading={t(`Confirm deleting ${deleteTerm} conversations`)}
        description={
          t(
            `Are you sure that you want to delete ${deleteTerm} conversations?`,
          ) || ''
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsClearModalOpen(false);
          if (result) {
            if (!isSelectMode) {
              dispatch(ConversationsActions.clearConversations());
            } else {
              dispatch(ConversationsActions.deleteChosenConversations());
            }
          }
        }}
      />
    </>
  );
};
