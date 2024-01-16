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

import { DisplayMenuItemProps } from '@/src/types/menu';
import { PublishAttachmentInfo } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { stopBubbling } from '@/src/constants/chat';
import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import SidebarActionButton from '../Buttons/SidebarActionButton';
import ContextMenu from '../Common/ContextMenu';
import Tooltip from '../Common/Tooltip';
import DownloadRenderer from '../Files/Download';

interface Props {
  file: PublishAttachmentInfo;
  isRenaming: boolean;
  onRename: (
    file: PublishAttachmentInfo,
    newName: string,
    cancel?: boolean,
  ) => void;
  onStartRename: (file: PublishAttachmentInfo) => void;
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

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }); // set auto-focus
    }
  }, [isRenaming]);

  const handleCancel: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      onRename(file, file.name, true);
      setName(getFileNameWithoutExtension(file.name));
    },
    [file, onRename],
  );

  const handleEnterDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        onRename(file, fileName);
      }
    },
    [file, fileName, onRename],
  );

  const handleConfirm: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      onRename(file, fileName);
    },
    [file, fileName, onRename],
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
        display: file.status !== 'UPLOADING' && file.status !== 'FAILED',
        onClick: (e: MouseEvent) => stopBubbling(e),
        className: 'flex gap-3',
        customTriggerData: file,
        CustomTriggerRenderer: DownloadRenderer,
      },
    ],
    [file, onStartRename, t],
  );

  if (!file) return null;

  const fullPath = constructPath(t(PUBLISHING_FOLDER_NAME), file.path);

  return (
    <div
      className={classNames(
        'group relative flex w-full max-w-full items-center rounded p-2 hover:bg-accent-primary-alpha',
        !isRenaming && 'hover:pr-6',
      )}
    >
      <IconFile className="mr-2 shrink-0 text-secondary" size={18} />
      <div className="flex min-w-0 shrink grow flex-col">
        {!isRenaming ? (
          <>
            <Tooltip
              tooltip={fileName}
              triggerClassName="block max-w-full truncate"
            >
              {fileName}
            </Tooltip>
            <Tooltip
              tooltip={fullPath}
              triggerClassName="block max-w-full truncate text-secondary"
            >
              {fullPath}
            </Tooltip>
          </>
        ) : (
          <>
            <div className="relative flex grow items-center">
              <input
                className="mr-14 grow text-ellipsis rounded bg-transparent p-2 pr-12 placeholder:text-secondary focus:outline-none"
                type="text"
                value={nameWithoutExtension}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleEnterDown}
                autoFocus
                ref={inputRef}
              />
              <span className="absolute right-16">{fileExtension}</span>
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
          </>
        )}
      </div>
      {!isRenaming && (
        <ContextMenu
          menuItems={menuItems}
          TriggerIcon={IconDots}
          triggerIconHighlight
          triggerIconSize={18}
          triggerIconClassName="absolute right-1 group-hover:visible invisible"
        />
      )}
    </div>
  );
};
