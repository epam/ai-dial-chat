import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconFolder } from '@tabler/icons-react';
import {
  DragEvent,
  FC,
  Fragment,
  KeyboardEvent,
  MouseEvent,
  MouseEventHandler,
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import useOutsideAlerter from '@/src/hooks/useOutsideAlerter';

import { getFoldersDepth } from '@/src/utils/app/folders';
import { doesEntityContainSearchItem } from '@/src/utils/app/search';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { emptyImage } from '@/src/constants/drag-and-drop';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import CaretIconComponent from '@/src/components/Common/CaretIconComponent';

import CheckIcon from '../../../public/images/icons/check.svg';
import XmarkIcon from '../../../public/images/icons/xmark.svg';
import PublishModal from '../Chat/PublishModal';
import ShareModal from '../Chat/ShareModal';
import UnpublishModal from '../Chat/UnpublishModal';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { FolderContextMenu } from '../Common/FolderContextMenu';
import ShareIcon from '../Common/ShareIcon';
import { Spinner } from '../Common/Spinner';
import { BetweenFoldersLine } from '../Sidebar/BetweenFoldersLine';

interface Props<T, P = unknown> {
  currentFolder: FolderInterface;
  itemComponent?: FC<{
    item: T;
    level: number;
    readonly?: boolean;
    additionalItemData?: Record<string, unknown>;
    onEvent?: (eventId: string, data: P) => void;
  }>;
  allItems?: T[];
  allFolders: FolderInterface[];
  level?: number;
  highlightedFolders?: string[];
  searchTerm: string;
  openedFoldersIds: string[];
  isInitialRenameEnabled?: boolean;
  newAddedFolderId?: string;
  loadingFolderId?: string;
  displayCaretAlways?: boolean;
  additionalItemData?: Record<string, unknown>;
  handleDrop?: (e: any, folder: FolderInterface) => void;
  onDropBetweenFolders?: (
    folder: FolderInterface,
    parentFolderId: string | undefined,
    index: number,
  ) => void;
  onRenameFolder?: (newName: string, folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onAddFolder?: (parentFolderId: string) => void;
  onClickFolder: (folderId: string) => void;
  featureType?: FeatureType;
  onItemEvent?: (eventId: string, data: unknown) => void;
  readonly?: boolean;
}

const Folder = <T extends Conversation | Prompt | DialFile>({
  currentFolder,
  searchTerm,
  itemComponent,
  allItems,
  allFolders,
  highlightedFolders,
  openedFoldersIds,
  level = 0,
  isInitialRenameEnabled = false,
  newAddedFolderId,
  loadingFolderId = '',
  displayCaretAlways = false,
  additionalItemData,
  handleDrop,
  onDropBetweenFolders,
  onRenameFolder,
  onDeleteFolder,
  onClickFolder,
  onAddFolder,
  onItemEvent,
  featureType,
  readonly = false,
}: Props<T>) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const [isDeletingConfirmDialog, setIsDeletingConfirmDialog] = useState(false);
  const [isRenaming, setIsRenaming] = useState(
    isInitialRenameEnabled &&
      newAddedFolderId === currentFolder.id &&
      !currentFolder.serverSynced,
  );
  const [renameValue, setRenameValue] = useState(currentFolder.name);
  const [isSelected, setIsSelected] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDropAllowed, setIsDropAllowed] = useState(true);
  const [isContextMenu, setIsContextMenu] = useState(false);
  const dragDropElement = useRef<HTMLDivElement>(null);

  const [isSharing, setIsSharing] = useState(false);
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );

  const handleOpenSharing: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    setIsSharing(true);
  }, []);

  const handleCloseShareModal = useCallback(() => {
    setIsSharing(false);
  }, []);

  const handleOpenPublishing: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    setIsPublishing(true);
  }, []);

  const handleClosePublishModal = useCallback(() => {
    setIsPublishing(false);
  }, []);

  const handleOpenUnpublishing: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    setIsUnpublishing(true);
  }, []);

  const handleCloseUnpublishModal = useCallback(() => {
    setIsUnpublishing(false);
  }, []);

  const isFolderOpened = useMemo(() => {
    return openedFoldersIds.includes(currentFolder.id);
  }, [currentFolder.id, openedFoldersIds]);
  const filteredChildFolders = useMemo(() => {
    return allFolders.filter((folder) => folder.folderId === currentFolder.id);
  }, [currentFolder, allFolders]);
  const filteredChildItems = useMemo(() => {
    return (
      allItems?.filter(
        (item) =>
          item.folderId === currentFolder.id &&
          doesEntityContainSearchItem(item, searchTerm),
      ) || []
    );
  }, [allItems, currentFolder.id, searchTerm]);
  const hasChildElements = useMemo(() => {
    return filteredChildFolders.length > 0 || filteredChildItems.length > 0;
  }, [filteredChildFolders.length, filteredChildItems.length]);
  const dragImageRef = useRef<HTMLImageElement | null>();

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    dragImageRef.current = document.createElement('img');
    dragImageRef.current.src = emptyImage;
  }, []);

  const handleRename = useCallback(() => {
    if (!onRenameFolder) {
      return;
    }
    onRenameFolder(renameValue, currentFolder.id);
    setRenameValue('');
    setIsRenaming(false);
    setIsContextMenu(false);
  }, [onRenameFolder, renameValue, currentFolder]);

  const handleEnterDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRename();
      }
    },
    [handleRename],
  );

  const dropHandler = useCallback(
    (e: any) => {
      if (!isDropAllowed || !handleDrop) {
        return;
      }

      if (e.dataTransfer) {
        e.preventDefault();
        e.stopPropagation();

        dispatch(UIActions.openFolder({ id: currentFolder.id }));
        setIsDraggingOver(false);

        const folderData = e.dataTransfer.getData('folder');

        if (folderData) {
          const foldersDepth = getFoldersDepth(
            JSON.parse(folderData),
            allFolders,
          );

          if (level + foldersDepth > 3) {
            dispatch(
              UIActions.showToast({
                message: t("It's not allowed to have more nested folders"),
                type: 'error',
              }),
            );
            return;
          }
        }
        handleDrop(e, currentFolder);
      }
    },
    [isDropAllowed, handleDrop, dispatch, currentFolder, allFolders, level, t],
  );

  const allowDrop = useCallback(
    (e: any) => {
      if (isDropAllowed) {
        e.preventDefault();
      }
    },
    [isDropAllowed],
  );

  const isParentFolder = useCallback(
    (currentFolder: Element, checkedElement: Element) => {
      let isParentFolder = true;
      let parent = checkedElement.parentElement;
      while (parent) {
        if (parent.id === 'folder' && parent !== currentFolder) {
          isParentFolder = false;
          break;
        }
        if (currentFolder === parent) {
          break;
        }

        parent = parent.parentElement;
      }

      return isParentFolder;
    },
    [],
  );

  const highlightDrop = useCallback(
    (evt: any) => {
      if (dragDropElement.current === evt.target) {
        setIsDraggingOver(true);
        return;
      }

      if (
        dragDropElement.current?.contains(evt.target) &&
        isParentFolder(dragDropElement.current, evt.target)
      ) {
        dispatch(UIActions.openFolder({ id: currentFolder.id }));
        setIsDraggingOver(true);
      }
    },
    [currentFolder.id, dispatch, isParentFolder],
  );

  const removeHighlight = useCallback(
    (evt: any) => {
      if (!dragDropElement.current?.contains(evt.relatedTarget)) {
        setIsDraggingOver(false);
        return;
      }

      if (!isParentFolder(dragDropElement.current, evt.relatedTarget)) {
        setIsDraggingOver(false);
      }
    },
    [isParentFolder],
  );

  const onRename: MouseEventHandler = useCallback(
    (e) => {
      if (!onRenameFolder) {
        return;
      }

      e.stopPropagation();
      setIsRenaming(true);
      setRenameValue(currentFolder.name);
    },
    [currentFolder.name, onRenameFolder],
  );

  const onDelete: MouseEventHandler = useCallback(
    (e) => {
      if (!onDeleteFolder) {
        return;
      }

      e.stopPropagation();
      setIsDeletingConfirmDialog(true);
    },
    [onDeleteFolder],
  );
  const onAdd: MouseEventHandler = useCallback(
    (e) => {
      if (!onAddFolder) {
        return;
      }

      e.stopPropagation();
      onAddFolder(currentFolder.id);
    },
    [currentFolder.id, onAddFolder],
  );

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, folder: FolderInterface) => {
      if (e.dataTransfer) {
        e.dataTransfer.setDragImage(dragImageRef.current || new Image(), 0, 0);
        e.dataTransfer.setData('folder', JSON.stringify(folder));
        dispatch(UIActions.closeFolder({ id: currentFolder.id }));
      }
    },
    [currentFolder.id, dispatch],
  );

  const onDraggingBetweenFolders = useCallback((isDraggingOver: boolean) => {
    setIsDropAllowed(!isDraggingOver);
  }, []);

  const handleContextMenuOpen = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };

  useEffect(() => {
    if (isRenaming) {
      setIsDeletingConfirmDialog(false);
    } else if (isDeletingConfirmDialog) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeletingConfirmDialog]);

  useEffect(() => {
    if (searchTerm) {
      dispatch(UIActions.openFolder({ id: currentFolder.id }));
    }
  }, [currentFolder.id, dispatch, searchTerm]);

  useOutsideAlerter(dragDropElement, setIsSelected);

  return (
    <div
      id="folder"
      className={classNames(
        'transition-colors duration-200',
        isDraggingOver && isDropAllowed && 'bg-accent-primary',
      )}
      onDrop={dropHandler}
      onDragOver={allowDrop}
      onDragEnter={highlightDrop}
      onDragLeave={removeHighlight}
      onContextMenu={handleContextMenuOpen}
      ref={dragDropElement}
    >
      <div
        className={classNames(
          'relative flex h-[30px] items-center rounded border-l-2 hover:bg-accent-primary',
          isRenaming ||
            isContextMenu ||
            (allItems === undefined &&
              highlightedFolders?.includes(currentFolder.id))
            ? 'border-accent-primary bg-accent-primary'
            : 'border-transparent',
        )}
        data-qa="folder"
      >
        {isRenaming ? (
          <div
            className={classNames('flex w-full items-center gap-1 py-2 pr-3')}
            style={{
              paddingLeft: `${level * 1.5}rem`,
            }}
          >
            <CaretIconComponent
              isOpen={isFolderOpened}
              hidden={!hasChildElements && !displayCaretAlways}
            />

            {loadingFolderId === currentFolder.id ? (
              <Spinner />
            ) : (
              <ShareIcon
                {...currentFolder}
                isHighlighted
                featureType={featureType}
              >
                <IconFolder size={18} className="mr-1 text-secondary" />
              </ShareIcon>
            )}

            <input
              className="mr-12 flex-1 overflow-hidden text-ellipsis bg-transparent text-left outline-none"
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleEnterDown}
              autoFocus
            />
          </div>
        ) : (
          <div
            className={classNames(
              `group/button flex h-full w-full cursor-pointer items-center gap-1 py-2 pr-3`,
            )}
            style={{
              paddingLeft: `${level * 24}px`,
            }}
            onClick={() => {
              onClickFolder(currentFolder.id);

              setIsSelected(true);
            }}
            draggable={!!handleDrop}
            onDragStart={(e) => handleDragStart(e, currentFolder)}
            onDragOver={(e) => {
              e.preventDefault();
            }}
          >
            <CaretIconComponent
              isOpen={isFolderOpened}
              hidden={!hasChildElements && !displayCaretAlways}
            />

            {loadingFolderId === currentFolder.id ? (
              <Spinner className="mr-1" />
            ) : (
              <ShareIcon
                {...currentFolder}
                isHighlighted={isContextMenu}
                featureType={featureType}
              >
                <IconFolder size={18} className="mr-1 text-secondary" />
              </ShareIcon>
            )}
            <div
              className={classNames(
                `relative max-h-5 flex-1 truncate break-all text-left`,
                isRenaming ? 'pr-10' : 'group-hover/button:pr-5',
                !isRenaming &&
                  highlightedFolders?.includes(currentFolder.id) &&
                  'text-primary',
              )}
              data-qa="folder-name"
            >
              {currentFolder.name}
            </div>
            {(onDeleteFolder || onRenameFolder || onAddFolder) &&
              !readonly &&
              !isRenaming && (
                <div
                  ref={refs.setFloating}
                  {...getFloatingProps()}
                  className={classNames(
                    'invisible absolute right-3 z-50 flex justify-end md:group-hover/button:visible',
                    isSelected || isContextMenu ? 'max-md:visible' : '',
                  )}
                >
                  <FolderContextMenu
                    folder={currentFolder}
                    featureType={featureType}
                    onRename={
                      (onRenameFolder &&
                        !currentFolder.serverSynced &&
                        onRename) ||
                      undefined
                    }
                    onDelete={onDeleteFolder && onDelete}
                    onAddFolder={onAddFolder && onAdd}
                    onShare={handleOpenSharing}
                    onPublish={handleOpenPublishing}
                    onPublishUpdate={handleOpenPublishing}
                    onUnpublish={handleOpenUnpublishing}
                    onOpenChange={setIsContextMenu}
                    isOpen={isContextMenu}
                  />
                </div>
              )}
          </div>
        )}
        {isRenaming && (
          <div className="absolute right-1 z-10 flex">
            <SidebarActionButton
              handleClick={(e) => {
                e.stopPropagation();
                if (isRenaming) {
                  handleRename();
                }

                setIsRenaming(false);
              }}
            >
              <CheckIcon
                width={18}
                height={18}
                size={18}
                className="hover:text-primary"
              />
            </SidebarActionButton>
            <SidebarActionButton
              handleClick={(e) => {
                e.stopPropagation();
                setIsRenaming(false);
              }}
            >
              <XmarkIcon
                width={18}
                height={18}
                size={18}
                className="hover:text-primary"
                strokeWidth="2"
              />
            </SidebarActionButton>
          </div>
        )}
      </div>
      {isFolderOpened ? (
        <div className={classNames('flex flex-col gap-0.5')}>
          <div className={classNames('flex flex-col')}>
            {allFolders.map((item, index, arr) => {
              if (item.folderId === currentFolder.id) {
                return (
                  <Fragment key={item.id}>
                    {onDropBetweenFolders && (
                      <BetweenFoldersLine
                        level={level + 1}
                        onDrop={onDropBetweenFolders}
                        onDraggingOver={onDraggingBetweenFolders}
                        index={index}
                        parentFolderId={item.folderId}
                      />
                    )}
                    <Folder
                      readonly={readonly}
                      level={level + 1}
                      searchTerm={searchTerm}
                      currentFolder={item}
                      itemComponent={itemComponent}
                      allItems={allItems}
                      allFolders={allFolders}
                      highlightedFolders={highlightedFolders}
                      openedFoldersIds={openedFoldersIds}
                      loadingFolderId={loadingFolderId}
                      displayCaretAlways={displayCaretAlways}
                      additionalItemData={additionalItemData}
                      isInitialRenameEnabled={isInitialRenameEnabled}
                      newAddedFolderId={newAddedFolderId}
                      handleDrop={handleDrop}
                      onDropBetweenFolders={onDropBetweenFolders}
                      onRenameFolder={onRenameFolder}
                      onDeleteFolder={onDeleteFolder}
                      onAddFolder={onAddFolder}
                      onClickFolder={onClickFolder}
                      onItemEvent={onItemEvent}
                      featureType={featureType}
                    />
                    {onDropBetweenFolders && index === arr.length - 1 && (
                      <BetweenFoldersLine
                        level={level + 1}
                        onDrop={onDropBetweenFolders}
                        onDraggingOver={onDraggingBetweenFolders}
                        index={index + 1}
                        parentFolderId={item.folderId}
                      />
                    )}
                  </Fragment>
                );
              }

              return null;
            })}
          </div>
          {itemComponent &&
            filteredChildItems.map((item) => (
              <div key={item.id}>
                {createElement(itemComponent, {
                  item,
                  level: level + 1,
                  readonly,
                  additionalItemData,
                  ...(!!onItemEvent && { onEvent: onItemEvent }),
                })}
              </div>
            ))}
        </div>
      ) : null}
      {onDeleteFolder && (
        <ConfirmDialog
          isOpen={isDeletingConfirmDialog}
          heading={t('Confirm deleting folder')}
          description={
            t(
              'Are you sure that you want to remove a folder with all nested elements?',
            ) || ''
          }
          confirmLabel={t('Remove')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsDeletingConfirmDialog(false);
            if (result) {
              onDeleteFolder(currentFolder.id);
            }
          }}
        />
      )}
      {isSharing && isSharingEnabled && (
        <ShareModal
          entity={currentFolder}
          type={
            featureType === FeatureType.Prompt
              ? SharingType.PromptFolder
              : SharingType.ConversationFolder
          }
          isOpen
          onClose={handleCloseShareModal}
        />
      )}
      {isPublishing && isPublishingEnabled && (
        <PublishModal
          entity={currentFolder}
          type={
            featureType === FeatureType.Prompt
              ? SharingType.PromptFolder
              : SharingType.ConversationFolder
          }
          isOpen
          onClose={handleClosePublishModal}
        />
      )}
      {isUnpublishing && isPublishingEnabled && (
        <UnpublishModal
          entity={currentFolder}
          type={
            featureType === FeatureType.Prompt
              ? SharingType.PromptFolder
              : SharingType.ConversationFolder
          }
          isOpen
          onClose={handleCloseUnpublishModal}
        />
      )}
    </div>
  );
};

export default Folder;
