import { IconPencil } from '@tabler/icons-react';
import { ReactNode } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import Tooltip from './Tooltip';

import ArrowUpRight from '@/public/images/icons/arrow-up-right.svg';
import World from '@/public/images/icons/world.svg';
import { ShareInterface } from '@epam/ai-dial-shared';

interface ShareIconProps extends ShareInterface {
  isHighlighted: boolean;
  size?: number;
  children: ReactNode | ReactNode[];
  featureType: FeatureType;
  containerClassName?: string;
  iconClassName?: string;
  iconWrapperClassName?: string;
  isMyEntity?: boolean;
}

export default function ShareIcon({
  isShared,
  isPublished,
  isHighlighted,
  size = 12,
  children,
  featureType,
  containerClassName,
  iconClassName,
  iconWrapperClassName,
  isMyEntity,
}: ShareIconProps) {
  const { t } = useTranslation(Translation.SideBar);
  const isApplication = featureType === FeatureType.Application;
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, featureType),
  );
  const containerClass = classNames(
    'relative text-primary',
    containerClassName,
  );

  if (
    (!isSharingEnabled || !isShared) &&
    (!isPublishingEnabled || !isPublished) &&
    !isMyEntity
  ) {
    return <div className={containerClass}>{children}</div>;
  }

  const AdditionalIcon =
    isPublished && isPublishingEnabled
      ? World
      : isShared
        ? ArrowUpRight
        : IconPencil;

  const isMyEntityIcon = isMyEntity && !isPublished && !isShared;

  return (
    <div className={containerClass}>
      {children}
      <div
        className={classNames(
          'absolute bg-layer-3',
          isPublished && 'rounded-md',
          isApplication
            ? 'bottom-0 left-0 rounded-none rounded-tr-[4px] stroke-[0.6]'
            : '-bottom-1 -left-1 rounded-sm stroke-[1.5]',
          iconWrapperClassName,
        )}
        data-qa={
          isPublished && isPublishingEnabled ? 'world-icon' : 'arrow-icon'
        }
      >
        <Tooltip
          tooltip={
            isPublished
              ? t('Published')
              : isShared
                ? t('Shared')
                : t('Created by me')
          }
        >
          <AdditionalIcon
            size={size}
            width={size}
            height={size}
            className={classNames(
              'p-px text-accent-primary group-hover:bg-accent-primary-alpha',
              isHighlighted && 'bg-accent-primary-alpha',
              isPublished && '!rounded-md',
              isApplication
                ? 'rounded-none rounded-tr-[4px] stroke-[0.6]'
                : 'rounded-sm stroke-[1.5]',
              isMyEntityIcon && '!stroke-[1.5]',
              iconClassName,
            )}
          />
        </Tooltip>
      </div>
    </div>
  );
}
