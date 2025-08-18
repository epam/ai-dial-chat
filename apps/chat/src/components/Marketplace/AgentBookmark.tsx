import { IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isMyApplication } from '@/src/utils/app/id';

import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props<T> {
  entity: T;
  size?: number;
  className?: string;
  onBookmarkClick?: (entity: T) => void;
  allocatePlace?: boolean;
}

export const AgentBookmark = <T extends DialAIEntityModel | ToolsetModel>({
  entity,
  size = 18,
  className,
  onBookmarkClick,
  allocatePlace = false,
}: Props<T>) => {
  const { t } = useTranslation(Translation.Marketplace);

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const isMyApp = isMyApplication(entity);

  const hidden = isMyApp || entity.sharedWithMe;
  if (hidden && !allocatePlace) {
    return null;
  }

  const [Bookmark, tooltip, dataQa] = installedModelIds.has(entity.reference)
    ? [IconBookmarkFilled, 'Remove from My workspace', 'remove-bookmark']
    : [IconBookmark, 'Add to My workspace', 'add-bookmark'];

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        !hidden && onBookmarkClick?.(entity);
      }}
    >
      <Tooltip
        tooltip={t(tooltip)}
        triggerClassName={classNames(
          className,
          'group flex items-center',
          hidden ? 'invisible' : 'cursor-pointer',
        )}
        isTriggerClickable
      >
        <button data-qa={dataQa}>
          <Bookmark
            className="rounded text-secondary hover:text-accent-primary group-hover/bookmark:text-accent-primary"
            size={size}
          />
        </button>
      </Tooltip>
    </div>
  );
};
