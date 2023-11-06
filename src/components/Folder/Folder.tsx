import { IconCaretRightFilled, IconFolder } from '@tabler/icons-react';
import {
  DragEvent,
  FC,
  Fragment,
  KeyboardEvent,
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

import { Conversation } from '@/src/types/chat';
import { HighlightColor } from '@/src/types/components';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { emptyImage } from '@/src/constants/drag-and-drop';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';

import CheckIcon from '../../../public/images/icons/check.svg';
import XmarkIcon from '../../../public/images/icons/xmark.svg';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { FolderContextMenu } from '../Common/FolderContextMenu';
import { BetweenFoldersLine } from '../Sidebar/BetweenFoldersLine';

interface CaretIconComponentProps {
  isOpen: boolean;
}

const CaretIconComponent = ({ isOpen }: CaretIconComponentProps) => {
  return (
    <IconCaretRightFilled
      className={classNames(
        'invisible text-gray-500 transition-all group-hover/sidebar:[visibility:inherit]',
        isOpen && 'rotate-90',
      )}
      size={10}
    />
  );
};

interface Props<T> {
  currentFolder: FolderInterface;
  itemComponent: FC<{ item: T; level: number }>;
  allItems: T[];
  allFolders: FolderInterface[];
  level?: number;
  highlightColor: HighlightColor;
  highlightedFolders?: string[];
  searchTerm: string;
  handleDrop: (e: any, folder: FolderInterface) => void;
  onDropBetweenFolders: (
    folder: FolderInterface,
    parentFolderId: string | undefined,
    index: number,
  ) => void;
  onRenameFolder: (newName: string, folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

const Folder = <T extends Conversation | Prompt>({
  currentFolder,
  searchTerm,
  itemComponent,
  allItems,
  allFolders,
  highlightColor,
  highlightedFolders,
  level = 0,
  handleDrop,
  onDropBetweenFolders,
  onRenameFolder,
  onDeleteFolder,
}: Props<T>) => {
  const { t } = useTranslation('chat');
  const dispatch = useAppDispatch();
  const isFolderOpened = useAppSelector((state) =>
    UISelectors.selectIsFolderOpened(state, currentFolder.id),
  );
  const [isDeletingConfirmDialog, setIsDeletingConfirmDialog] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSelected, setIsSelected] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDropAllowed, setIsDropAllowed] = useState(true);
  const dragDropElement = useRef<HTMLDivElement>(null);

  const filteredChildFolders = useMemo(() => {
    return allFolders.filter((folder) => folder.folderId === currentFolder.id);
  }, [currentFolder, allFolders]);
  const filteredChildItems = useMemo(() => {
    return allItems.filter((item) => item.folderId === currentFolder.id);
  }, [currentFolder, allItems]);
  const hasChildElements = useMemo(() => {
    return filteredChildFolders.length > 0 || filteredChildItems.length > 0;
  }, [filteredChildFolders.length, filteredChildItems.length]);
  const dragImageRef = useRef<HTMLImageElement | null>();

  useEffect(() => {
    dragImageRef.current = document.createElement('img');
    dragImageRef.current.src = emptyImage;
  }, []);

  const handleRename = useCallback(() => {
    onRenameFolder(renameValue, currentFolder.id);
    setRenameValue('');
    setIsRenaming(false);
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
      if (!isDropAllowed) {
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
    [isDropAllowed, level, allFolders, currentFolder, dispatch, handleDrop],
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
      e.stopPropagation();
      setIsRenaming(true);
      setRenameValue(currentFolder.name);
    },
    [currentFolder.name],
  );

  const onDelete: MouseEventHandler = useCallback((e) => {
    e.stopPropagation();
    setIsDeletingConfirmDialog(true);
  }, []);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, folder: FolderInterface) => {
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
  }, [searchTerm]);

  useOutsideAlerter(dragDropElement, setIsSelected);

  const draggingColor =
    highlightColor === 'green' ? 'bg-green/15' : 'bg-violet/15';
  const hoverIconColor =
    highlightColor === 'green' ? 'hover:text-green' : 'hover:text-violet';
  const textColor = highlightColor === 'green' ? 'text-green' : 'text-violet';
  const bgColor = highlightColor === 'green' ? 'bg-green/15' : 'bg-violet/15';

  return (
    <div
      id="folder"
      className={classNames(
        'transition-colors duration-200',
        isDraggingOver && isDropAllowed && draggingColor,
      )}
      onDrop={dropHandler}
      onDragOver={allowDrop}
      onDragEnter={highlightDrop}
      onDragLeave={removeHighlight}
      ref={dragDropElement}
    >
      <div
        className={classNames(
          'relative flex h-[30px] items-center',
          isRenaming ? bgColor : '',
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
            <span
              className={classNames(hasChildElements ? 'visible' : 'invisible')}
            >
              <CaretIconComponent isOpen={isFolderOpened} />
            </span>

            <IconFolder size={18} className="mr-1 text-gray-500" />

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
          <button
            className={classNames(
              `group/button flex h-full w-full cursor-pointer items-center gap-1 py-2 pr-3`,
            )}
            style={{
              paddingLeft: `${level * 24}px`,
            }}
            onClick={() => {
              dispatch(UIActions.toggleFolder({ id: currentFolder.id }));

              setIsSelected(true);
            }}
            draggable="true"
            onDragStart={(e) => handleDragStart(e, currentFolder)}
            onDragOver={(e) => {
              e.preventDefault();
            }}
          >
            <span
              className={classNames(hasChildElements ? 'visible' : 'invisible')}
            >
              <CaretIconComponent isOpen={isFolderOpened} />
            </span>

            <IconFolder size={18} className="mr-1 text-gray-500" />

            <div
              className={classNames(
                `relative max-h-5 flex-1 truncate break-all text-left`,
                isRenaming ? 'pr-10' : 'group-hover/button:pr-5',
                !isRenaming &&
                  highlightedFolders?.includes(currentFolder.id) &&
                  textColor,
              )}
            >
              {currentFolder.name}
            </div>

            {!isRenaming && (
              <div
                className={classNames(
                  'invisible absolute right-3 z-50 flex justify-end md:group-hover/button:visible',
                  isSelected ? 'max-md:visible' : '',
                )}
              >
                <FolderContextMenu
                  onRename={onRename}
                  onDelete={onDelete}
                  highlightColor={highlightColor}
                />
              </div>
            )}
          </button>
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
                className={hoverIconColor}
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
                className={hoverIconColor}
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
                  <Fragment key={index}>
                    <BetweenFoldersLine
                      level={level + 1}
                      onDrop={onDropBetweenFolders}
                      onDraggingOver={onDraggingBetweenFolders}
                      index={index}
                      parentFolderId={item.folderId}
                      highlightColor={highlightColor}
                    />
                    <Folder
                      level={level + 1}
                      searchTerm={searchTerm}
                      currentFolder={item}
                      itemComponent={itemComponent}
                      allItems={allItems}
                      allFolders={allFolders}
                      highlightColor={highlightColor}
                      highlightedFolders={highlightedFolders}
                      handleDrop={handleDrop}
                      onDropBetweenFolders={onDropBetweenFolders}
                      onRenameFolder={onRenameFolder}
                      onDeleteFolder={onDeleteFolder}
                    />
                    {index === arr.length - 1 && (
                      <BetweenFoldersLine
                        level={level + 1}
                        onDrop={onDropBetweenFolders}
                        onDraggingOver={onDraggingBetweenFolders}
                        index={index + 1}
                        parentFolderId={item.folderId}
                        highlightColor={highlightColor}
                      />
                    )}
                  </Fragment>
                );
              }

              return null;
            })}
          </div>
          {filteredChildItems.map((item, index) => (
            <div key={index}>
              {createElement(itemComponent, {
                item,
                level: level + 1,
              })}
            </div>
          ))}
        </div>
      ) : null}

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
    </div>
  );
};

export default Folder;
