import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconScale,
  IconSquareCheck,
  IconSquareOff,
  IconTrashX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getConversationRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ImportExportActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { SideBarI18nKeys } from '@/src/constants/i18n';
import { PINNED_CONVERSATIONS_SECTION_NAME } from '@/src/constants/sections';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { SidebarMenu } from '@/src/components/Common/SidebarMenu';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { SupportedExportFormats } from '@epam/ai-dial-shared';

export const ChatbarSettings = () => {
  const { t } = useTranslation(Translation.SideBar);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const dispatch = useAppDispatch();

  const isStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const isMyItemsExist = useAppSelector(
    ConversationsSelectors.selectDoesAnyMyItemExist,
  );
  const isSelectMode = useAppSelector(
    ConversationsSelectors.selectIsSelectMode,
  );
  const isCompareModeDisabled = useAppSelector(
    SettingsSelectors.selectIsCompareModeDisabled,
  );

  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Chat),
    [],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);

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

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(SideBarI18nKeys.SelectAll),
        dataQa: 'select-all',
        Icon: IconSquareCheck,
        onClick: () => {
          dispatch(ConversationsActions.setAllChosenConversations());
        },
        display: isMyItemsExist,
        disabled: isStreaming,
      },
      {
        name: t(SideBarI18nKeys.UnselectAll),
        dataQa: 'unselect-all',
        Icon: IconSquareOff,
        onClick: () => {
          dispatch(ConversationsActions.resetChosenConversations());
        },
        display: isSelectMode,
        disabled: isStreaming,
      },
      {
        name: t(SideBarI18nKeys.CreateNewFolder),
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
          dispatch(ConversationsActions.resetSearch());
        },
        display: !isSelectMode,
        disabled: isStreaming,
      },
      {
        name: t(SideBarI18nKeys.ImportConversations),
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
        name: t(SideBarI18nKeys.ExportConversationsWithoutAttachments),
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
        name: t(
          isSelectMode
            ? SideBarI18nKeys.DeleteSelectedConversations
            : SideBarI18nKeys.DeleteAllConversations,
        ),
        display: isMyItemsExist,
        dataQa: 'delete-entities',
        Icon: IconTrashX,
        onClick: () => {
          setIsClearModalOpen(true);
        },
        disabled: isStreaming,
      },
      {
        name: t(SideBarI18nKeys.CompareMode),
        dataQa: 'compare',
        Icon: IconScale,
        disabled: isStreaming,
        onClick: () => {
          handleToggleCompare();
        },
        display: !isSelectMode && !isCompareModeDisabled,
      },
    ],
    [
      t,
      isMyItemsExist,
      isStreaming,
      isSelectMode,
      isCompareModeDisabled,
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
          onClose={() => {
            setIsSelectFilesDialogOpened(false);
          }}
          headerLabel={t(SideBarI18nKeys.ManageAttachments)}
          forceShowSelectCheckBox
        />
      )}

      <ConfirmDialog
        isOpen={isClearModalOpen}
        heading={t(
          isSelectMode
            ? SideBarI18nKeys.ConfirmDeletingSelectedConversations
            : SideBarI18nKeys.ConfirmDeletingAllConversations,
        )}
        description={t(
          isSelectMode
            ? SideBarI18nKeys.AreYouSureDeleteSelectedConversations
            : SideBarI18nKeys.AreYouSureDeleteAllConversations,
        )}
        confirmLabel={t(SideBarI18nKeys.Delete)}
        cancelLabel={t(SideBarI18nKeys.Cancel)}
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
