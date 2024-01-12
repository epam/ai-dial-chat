import {
  IconDots,
  IconDownload,
  IconFile,
  IconPencilMinus,
} from '@tabler/icons-react';
import { MouseEvent, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { constructPath } from '@/src/utils/app/file';

import { DisplayMenuItemProps } from '@/src/types/menu';
import { PublishAttachmentInfo } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { stopBubbling } from '@/src/constants/chat';
import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import ContextMenu from '../Common/ContextMenu';
import Tooltip from '../Common/Tooltip';
import DownloadRenderer from '../Files/Download';

interface Props {
  file: PublishAttachmentInfo;
}

export const PublishAttachment = ({ file }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Rename'),
        dataQa: 'rename',
        Icon: IconPencilMinus,
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
    [file, t],
  );

  if (!file) return null;

  const fullPath = constructPath(t(PUBLISHING_FOLDER_NAME), file.path);

  return (
    <div className="group flex w-full max-w-full items-center">
      <IconFile className="mr-2 shrink-0 text-secondary" size={18} />
      <div className="flex min-w-0 shrink grow flex-col">
        <Tooltip
          tooltip={file.name}
          triggerClassName="block max-w-full truncate"
        >
          {file.name}
        </Tooltip>
        <Tooltip
          tooltip={fullPath}
          triggerClassName="block max-w-full truncate text-secondary"
        >
          {fullPath}
        </Tooltip>
      </div>
      <ContextMenu
        menuItems={menuItems}
        TriggerIcon={IconDots}
        triggerIconHighlight
        triggerIconSize={18}
        triggerIconClassName="ml-2 group-hover:block"
      />
    </div>
  );
};
