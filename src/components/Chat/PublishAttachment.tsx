import { IconFile } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { constructPath } from '@/src/utils/app/file';

import { PublishAttachmentInfo } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import Tooltip from '../Common/Tooltip';

interface Props {
  item: PublishAttachmentInfo;
}

export const PublishAttachment = ({ item }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  if (!item) return null;
  return (
    <div className="flex max-w-full items-center">
      <IconFile className="mr-2 shrink-0 text-secondary" size={18} />
      <div className="flex min-w-0 shrink flex-col">
        <Tooltip
          tooltip={item.title}
          triggerClassName="block max-w-full truncate"
        >
          {item.title}
        </Tooltip>
        <div className="block max-w-full truncate text-secondary">
          {constructPath(t(PUBLISHING_FOLDER_NAME), item.path)}
        </div>
      </div>
    </div>
  );
};
