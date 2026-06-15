import { DragEvent, ReactNode, useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { hasDragEventEntityData } from '@/src/utils/app/move';
import { SidebarSide } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { PromptBarI18nKeys } from '@/src/constants/i18n';

import { Loader } from '@/src/components/Common/Loader';
import {
  CreateNewConversation,
  CreateNewPrompt,
} from '@/src/components/Header/CreateNewEntity';
import { Search } from '@/src/components/Search/Search';

import { ResizableSidebarWrapper } from './ResizableSidebarWrapper';
import { SidebarSections } from './SidebarSections';

interface Props<T> {
  isOpen: boolean;
  side: SidebarSide;
  filteredItems: T[];
  filteredFolders: FolderInterface[];
  itemComponent: ReactNode | ((isDraggingOver: boolean) => ReactNode);
  folderComponent: ReactNode;
  footerComponent?: ReactNode;
  searchTerm: string;
  searchFilters: SearchFilters;
  featureType: FeatureType.Chat | FeatureType.Prompt;
  onSearchTerm: (searchTerm: string) => void;
  onSearchFilters: (searchFilters: SearchFilters) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  toggleOpen?: () => void;
  areEntitiesUploaded: boolean;
}

export const Sidebar = <T,>({
  isOpen,
  side,
  filteredItems,
  filteredFolders,
  itemComponent,
  folderComponent,
  footerComponent,
  searchTerm,
  searchFilters,
  featureType,
  onSearchTerm,
  onSearchFilters,
  onDrop,
  areEntitiesUploaded,
}: Props<T>) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const isLeftSidebar = side === SidebarSide.Left;

  const dataQa = useMemo(
    () => (isLeftSidebar ? 'chatbar' : 'promptbar'),
    [isLeftSidebar],
  );

  const allowDrop = useCallback(
    (e: DragEvent) => {
      if (hasDragEventEntityData(e, featureType)) {
        e.preventDefault();
      }
    },
    [featureType],
  );

  const handleClose = useCallback(() => {
    if (isLeftSidebar) {
      dispatch(UIActions.setShowChatbar(false));
    } else {
      dispatch(UIActions.setShowPromptbar(false));
    }
  }, [dispatch, isLeftSidebar]);

  const searchPlaceholder = useMemo(() => {
    const entityKey =
      featureType === FeatureType.Chat
        ? PromptBarI18nKeys.ConversationEntity
        : PromptBarI18nKeys.PromptEntity;
    const entityName = t(entityKey);

    return t(PromptBarI18nKeys.Search, { name: entityName });
  }, [featureType, t]);

  if (!isOpen) {
    return null;
  }

  const createIconSize = isOverlay ? 18 : 24;
  const CreateNewEntity = isLeftSidebar
    ? CreateNewConversation
    : CreateNewPrompt;

  return (
    <ResizableSidebarWrapper
      dataQa={dataQa}
      isLeftSidebar={isLeftSidebar}
      handleClose={handleClose}
    >
      {areEntitiesUploaded ? (
        <>
          <div
            className={classNames(
              'flex items-center justify-between px-5',
              isOverlay ? 'min-h-[35px]' : 'min-h-12',
            )}
          >
            <p className="text-base font-semibold">
              {t(
                isLeftSidebar
                  ? PromptBarI18nKeys.Conversations
                  : PromptBarI18nKeys.Prompts,
              )}
            </p>
            <CreateNewEntity iconSize={createIconSize} />
          </div>
          <Search
            placeholder={searchPlaceholder}
            searchTerm={searchTerm}
            searchFilters={searchFilters}
            onSearch={onSearchTerm}
            onSearchFiltersChanged={onSearchFilters}
            featureType={featureType}
          />

          <SidebarSections
            searchTerm={searchTerm}
            filteredItems={filteredItems}
            filteredFolders={filteredFolders}
            featureType={featureType}
            itemComponent={itemComponent}
            folderComponent={folderComponent}
            onDrop={onDrop}
            allowDrop={allowDrop}
          />
          {footerComponent}
        </>
      ) : (
        <Loader />
      )}
    </ResizableSidebarWrapper>
  );
};
