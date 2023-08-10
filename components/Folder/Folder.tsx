import {
  KeyboardEvent,
  MouseEventHandler,
  ReactElement,
  useContext,
  useEffect,
  useState,
} from 'react';

import { FolderInterface } from '@/types/folder';

import HomeContext from '@/pages/api/home/home.context';

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';

import CaretDownIcon from '../../public/images/icons/caret-down.svg';
import CaretRightIcon from '../../public/images/icons/caret-right.svg';
import CheckIcon from '../../public/images/icons/check.svg';
import XmarkIcon from '../../public/images/icons/xmark.svg';
import { FolderContextMenu } from '../Common/FolderContextMenu';

import classNames from 'classnames';

interface Props {
  currentFolder: FolderInterface;
  searchTerm: string;
  handleDrop: (e: any, folder: FolderInterface) => void;
  folderComponent: (ReactElement | undefined)[];
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
  handleDrop,
  folderComponent,
}: Props) => {
  const { handleDeleteFolder, handleUpdateFolder } = useContext(HomeContext);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isShowContextMenuButton, setIsShowContextMenuButton] = useState(false);

  const handleEnterDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    }
  };

  const handleRename = () => {
    handleUpdateFolder(currentFolder.id, renameValue);
    setRenameValue('');
    setIsRenaming(false);
  };

  const dropHandler = (e: any) => {
    if (e.dataTransfer) {
      setIsOpen(true);

      handleDrop(e, currentFolder);

      e.target.style.background = 'none';
    }
  };

  const allowDrop = (e: any) => {
    e.preventDefault();
  };

  const highlightDrop = (e: any) => {
    e.target.style.background = '#343541';
  };

  const removeHighlight = (e: any) => {
    e.target.style.background = 'none';
  };

  const onRename: MouseEventHandler = (e) => {
    e.stopPropagation();
    setIsRenaming(true);
    setRenameValue(currentFolder.name);
  };

  const onDelete: MouseEventHandler = (e) => {
    e.stopPropagation();
    setIsDeleting(true);
  };

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

  return (
    <>
      <div
        className={classNames(
          'relative flex h-[42px] items-center rounded-[3px] hover:bg-green/[15%]',
          isRenaming || isDeleting ? 'bg-green/[15%]' : '',
        )}
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
            className={`flex w-full cursor-pointer items-center gap-3 p-3 transition-colors duration-200`}
            onClick={() => setIsOpen(!isOpen)}
            onDrop={(e) => dropHandler(e)}
            onDragOver={allowDrop}
            onDragEnter={highlightDrop}
            onDragLeave={removeHighlight}
            onMouseOver={() => {
              setIsShowContextMenuButton(true);
            }}
            onMouseLeave={() => {
              setIsShowContextMenuButton(false);
            }}
          >
            <CaretIconComponent isOpen={isOpen} />

            <div className="relative max-h-5 flex-1 truncate break-all text-left text-[12.5px] leading-3">
              {currentFolder.name}
            </div>

            {!isDeleting && !isRenaming && isShowContextMenuButton && (
              <FolderContextMenu onRename={onRename} onDelete={onDelete} />
            )}
          </button>
        )}
        {(isDeleting || isRenaming) && (
          <div className="absolute right-1 z-10 flex">
            <SidebarActionButton
              handleClick={(e) => {
                e.stopPropagation();

                if (isDeleting) {
                  handleDeleteFolder(currentFolder.id);
                } else if (isRenaming) {
                  handleRename();
                }

                setIsDeleting(false);
                setIsRenaming(false);
              }}
            >
              <CheckIcon width={18} height={18} size={18} />
            </SidebarActionButton>
            <SidebarActionButton
              handleClick={(e) => {
                e.stopPropagation();
                setIsDeleting(false);
                setIsRenaming(false);
              }}
            >
              <XmarkIcon width={18} height={18} size={18} strokeWidth="2" />
            </SidebarActionButton>
          </div>
        )}
      </div>

      {isOpen ? folderComponent : null}
    </>
  );
};

export default Folder;
