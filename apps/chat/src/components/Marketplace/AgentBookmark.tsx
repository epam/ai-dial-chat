import { IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isMyApplication } from '@/src/utils/app/id';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

interface Props {
  entity: DialAIEntityModel;
  size?: number;
  className?: string;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
}

export const AgentBookmark: React.FC<Props> = ({
  entity,
  size = 18,
  className,
  onBookmarkClick,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const isMyApp = isMyApplication(entity);

  if (isMyApp || entity.sharedWithMe) return null;

  const [Bookmark, tooltip, dataQa] = installedModelIds.has(entity.reference)
    ? [IconBookmarkFilled, 'Remove from My workspace', 'remove-bookmark']
    : [IconBookmark, 'Add to My workspace', 'add-bookmark'];

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onBookmarkClick?.(entity);
      }}
    >
      <Tooltip
        tooltip={t(tooltip)}
        triggerClassName={classNames(
          className,
          'group flex cursor-pointer items-center',
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
