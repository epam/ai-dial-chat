import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import {
  IconCheck,
  IconDots,
  IconDownload,
  IconFile,
  IconPencilMinus,
  IconX,
} from '@tabler/icons-react';
import {
  KeyboardEvent,
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  constructPath,
  getFileNameExtension,
  getFileNameWithoutExtension,
} from '@/src/utils/app/file';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { stopBubbling } from '@/src/constants/chat';
import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import SidebarActionButton from '../../Buttons/SidebarActionButton';
import ContextMenu from '../../Common/ContextMenu';
import Tooltip from '../../Common/Tooltip';
import DownloadRenderer from '../../Files/Download';

import { UploadStatus } from '@epam/ai-dial-shared';

interface Props {
  file: DialFile;
  isRenaming: boolean;
  onRename: (newName: string, cancel?: boolean) => void;
  onStartRename: (file: DialFile) => void;
}

export const PublishAttachment = ({
  file,
  onRename,
  onStartRename,
  isRenaming,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const inputRef = useRef<HTMLInputElement>(null);
  const [nameWithoutExtension, setName] = useState(
    getFileNameWithoutExtension(file.name),
  );
  const fileExtension = getFileNameExtension(file.name);
  const fileName = `${nameWithoutExtension}${fileExtension}`;
  const [isContextMenu, setIsContextMenu] = useState(false);

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });
  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }); // set auto-focus
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!isRenaming) {
      setName(getFileNameWithoutExtension(file.name));
    }
  }, [file.name, isRenaming]);

  const handleCancel: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      onRename(file.name, true);
      setName(getFileNameWithoutExtension(file.name));
    },
    [file, onRename],
  );

  const handleEnterDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        onRename(fileName);
      }
    },
    [fileName, onRename],
  );

  const handleConfirm: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      onRename(fileName);
    },
    [fileName, onRename],
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Rename'),
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: () => onStartRename(file),
      },
      {
        name: t('Download'),
        dataQa: 'download',
        Icon: IconDownload,
        display:
          file.status !== UploadStatus.LOADING &&
          file.status !== UploadStatus.FAILED,
        onClick: (e: MouseEvent) => stopBubbling(e),
        className: 'flex gap-3',
        customTriggerData: file,
        CustomTriggerRenderer: DownloadRenderer,
      },
    ],
    [file, onStartRename, t],
  );

  if (!file) return null;

  const fullPath = constructPath(PUBLISHING_FOLDER_NAME, file.relativePath);

  const handleContextMenuOpen = (e: MouseEvent) => {
    if (isRenaming) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };

  return (
    <div
      className={classNames(
        'group relative flex h-[56px] w-full max-w-full items-center rounded px-3 py-2 hover:bg-accent-primary-alpha',
        !isRenaming ? 'hover:pr-10' : 'bg-accent-primary-alpha',
      )}
      onContextMenu={handleContextMenuOpen}
    >
      <IconFile className="mr-2 shrink-0 text-secondary" size={18} />
      <div
        className={classNames(
          'flex min-w-0 shrink grow flex-col',
          !isRenaming && 'items-start',
        )}
      >
        {!isRenaming ? (
          <>
            <Tooltip
              isTriggerClickable
              tooltip={fileName}
              triggerClassName="block truncate max-w-full whitespace-pre"
              hideTooltip={isContextMenu}
            >
              {fileName}
            </Tooltip>
            <Tooltip
              tooltip={fullPath}
              triggerClassName="block max-w-full truncate text-secondary whitespace-pre"
              hideTooltip={isContextMenu}
            >
              {fullPath}
            </Tooltip>
          </>
        ) : (
          <div className="relative flex grow items-center">
            <input
              className="mr-14 grow text-ellipsis rounded bg-transparent p-2 pl-0 placeholder:text-secondary focus:outline-none"
              type="text"
              value={nameWithoutExtension}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleEnterDown}
              autoFocus
              ref={inputRef}
            />
            <div className="absolute right-0 z-10 flex">
              <SidebarActionButton handleClick={handleConfirm}>
                <IconCheck size={18} className="hover:text-accent-primary" />
              </SidebarActionButton>
              <SidebarActionButton handleClick={handleCancel}>
                <IconX
                  size={18}
                  strokeWidth="2"
                  className="hover:text-accent-primary"
                />
              </SidebarActionButton>
            </div>
          </div>
        )}
      </div>
      {!isRenaming && (
        <div
          ref={refs.setFloating}
          {...getFloatingProps()}
          className="invisible absolute right-4 h-[18px] group-hover:visible"
        >
          <ContextMenu
            menuItems={menuItems}
            TriggerIcon={IconDots}
            triggerIconHighlight
            triggerIconSize={18}
            isOpen={isContextMenu}
            featureType={FeatureType.File}
          />
        </div>
      )}
    </div>
  );
};
