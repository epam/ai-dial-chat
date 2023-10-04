import {
  KeyboardEvent,
  MouseEventHandler,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import useOutsideAlerter from '@/src/hooks/useOutsideAlerter';

import { HighlightColor } from '@/src/types/components';
import { FolderInterface } from '@/src/types/folder';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';

import CaretDownIcon from '../../../public/images/icons/caret-down.svg';
import CaretRightIcon from '../../../public/images/icons/caret-right.svg';
import CheckIcon from '../../../public/images/icons/check.svg';
import XmarkIcon from '../../../public/images/icons/xmark.svg';
import { FolderContextMenu } from '../Common/FolderContextMenu';

import classNames from 'classnames';

interface Props {
  highlightColor: HighlightColor;
  currentFolder: FolderInterface;
  searchTerm: string;
  folderComponent: ReactElement;
  handleDrop: (e: any, folder: FolderInterface) => void;
  onRenameFolder: (newName: string) => void;
  onDeleteFolder: () => void;
}

interface CaretIconComponentProps {
  isOpen: boolean;
}

const CaretIconComponent = ({ isOpen }: CaretIconComponentProps) => {
  return (
    <>
      {isOpen ? (
        <CaretDownIcon className="text-gray-500" width={18} height={18} />
      ) : (
        <CaretRightIcon className="text-gray-500" width={18} height={18} />
      )}
    </>
  );
};
const Folder = ({
  currentFolder,
  searchTerm,
  folderComponent,
  highlightColor,
  handleDrop,
  onRenameFolder,
  onDeleteFolder,
}: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const wrapperRef = useRef(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDropElement = useRef<HTMLDivElement>(null);

  const handleRename = useCallback(() => {
    onRenameFolder(renameValue);
    setRenameValue('');
    setIsRenaming(false);
  }, [onRenameFolder, renameValue]);

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
      if (e.dataTransfer) {
        setIsOpen(true);

        handleDrop(e, currentFolder);

        setIsDraggingOver(false);
      }
    },
    [currentFolder, handleDrop],
  );

  const allowDrop = useCallback((e: any) => {
    e.preventDefault();
  }, []);

  const highlightDrop = useCallback((evt: any) => {
    if (
      dragDropElement.current?.contains(evt.target) ||
      dragDropElement.current === evt.target
    ) {
      setIsDraggingOver(true);
    }
  }, []);

  const removeHighlight = useCallback((e: any) => {
    if (
      (e.target === dragDropElement.current ||
        dragDropElement.current?.contains(e.target)) &&
      !dragDropElement.current?.contains(e.relatedTarget)
    ) {
      setIsDraggingOver(false);
    }
  }, []);

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
    setIsDeleting(true);
  }, []);

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  useEffect(() => {
    if (searchTerm) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchTerm]);

  useOutsideAlerter(wrapperRef, setIsSelected);

  const hoverColor =
    highlightColor === 'green' ? 'hover:bg-green/15' : 'hover:bg-violet/15';
  const draggingColor =
    highlightColor === 'green' ? 'bg-green/15' : 'bg-violet/15';
  const hoverIconColor =
    highlightColor === 'green' ? 'hover:text-green' : 'hover:text-violet';
  const bgColor = highlightColor === 'green' ? 'bg-green/15' : 'bg-violet/15';

  return (
    <div
      className={classNames(
        'rounded transition-colors duration-200',
        isDraggingOver && draggingColor,
      )}
      onDrop={dropHandler}
      onDragOver={allowDrop}
      onDragEnter={highlightDrop}
      onDragLeave={removeHighlight}
      ref={dragDropElement}
    >
      <div
        className={classNames(
          'relative flex h-[42px] items-center rounded',
          isRenaming || isDeleting ? bgColor : '',
          hoverColor,
        )}
        ref={wrapperRef}
        data-qa="folder"
      >
        {isRenaming ? (
          <div className="flex w-full items-center gap-3 px-3">
            <CaretIconComponent isOpen={isOpen} />

            <input
              className="mr-12 flex-1 overflow-hidden text-ellipsis bg-transparent text-left leading-3 outline-none"
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleEnterDown}
              autoFocus
            />
          </div>
        ) : (
          <button
            className={`group flex h-full w-full cursor-pointer items-center gap-3 px-3`}
            onClick={() => {
              setIsOpen(!isOpen);
              setIsSelected(true);
            }}
          >
            <CaretIconComponent isOpen={isOpen} />

            <div
              className={`pointer-events-none relative max-h-5 flex-1 truncate break-all text-left ${
                isRenaming || isDeleting ? 'pr-10' : 'group-hover:pr-5'
              }`}
            >
              {currentFolder.name}
            </div>

            {!isDeleting && !isRenaming && (
              <div
                className={classNames(
                  'invisible absolute right-3 z-50 flex justify-end md:group-hover:visible',
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
        {(isDeleting || isRenaming) && (
          <div className="absolute right-1 z-10 flex">
            <SidebarActionButton
              handleClick={(e) => {
                e.stopPropagation();

                if (isDeleting) {
                  onDeleteFolder();
                } else if (isRenaming) {
                  handleRename();
                }

                setIsDeleting(false);
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
                setIsDeleting(false);
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

      {isOpen ? folderComponent : null}
    </div>
  );
};

export default Folder;
