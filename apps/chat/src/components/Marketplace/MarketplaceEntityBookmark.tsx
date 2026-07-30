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

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { MarketplaceEntitiesTabs } from '@/src/constants/marketplace';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { DialGhostIconButton } from '@epam/ai-dial-ui-kit';

interface Props<T> {
  entity: T;
  size?: number;
  className?: string;
  onBookmarkClick?: (entity: T) => void;
  allocatePlace?: boolean;
}

export const MarketplaceEntityBookmark = <T extends MarketplaceEntity>({
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

  const isAgentsTab = selectedEntitiesTab === MarketplaceEntitiesTabs.AGENTS;
  const isBookmarked = isAgentsTab
    ? installedModelIds.has(entity.reference)
    : installedToolsetsSet.has(entity.reference);
  const [Bookmark, tooltip, dataQa] = isBookmarked
    ? ([
        IconBookmarkFilled,
        MarketplaceI18nKeys.RemoveFromMyWorkspace,
        'remove-bookmark',
      ] as const)
    : ([
        IconBookmark,
        MarketplaceI18nKeys.AddToMyWorkspace,
        'add-bookmark',
      ] as const);

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
        <div data-qa={dataQa}>
          <DialGhostIconButton icon={<Bookmark />} />
        </div>
      </Tooltip>
    </div>
  );
};
