import { IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isMyApplication } from '@/src/utils/app/id';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceSelectors,
  ModelsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props<T> {
  entity: T;
  size?: number;
  className?: string;
  onBookmarkClick?: (entity: T) => void;
  allocatePlace?: boolean;
}

export const AgentBookmark = <T extends MarketplaceEntity>({
  entity,
  size = 18,
  className,
  onBookmarkClick,
  allocatePlace = false,
}: Props<T>) => {
  const { t } = useTranslation(Translation.Marketplace);

  const selectedEntitiesTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );

  const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const installedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );

  const isMyApp = isMyApplication(entity);

  const hidden = isMyApp || entity.sharedWithMe;
  if (hidden && !allocatePlace) {
    return null;
  }

  const isBookmarked = isAgentsTab
    ? installedModelIds.has(entity.reference)
    : installedToolsetsSet.has(entity.reference);
  const [Bookmark, tooltip, dataQa] = isBookmarked
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
