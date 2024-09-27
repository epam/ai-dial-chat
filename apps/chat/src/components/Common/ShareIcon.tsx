import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

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
}: ShareIconProps) {
  const { t } = useTranslation(Translation.SideBar);
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
    (!isPublishingEnabled || !isPublished)
  ) {
    return <div className={containerClass}>{children}</div>;
  }

  const AdditionalIcon =
    isPublished && isPublishingEnabled ? World : ArrowUpRight;

  return (
    <div className={containerClass}>
      {children}
      <div
        className={classNames(
          'absolute -bottom-1 -left-1 bg-layer-3',
          isPublished ? 'rounded-md' : 'rounded-sm',
          iconWrapperClassName,
        )}
        data-qa={
          isPublished && isPublishingEnabled ? 'world-icon' : 'arrow-icon'
        }
      >
        <Tooltip tooltip={isPublished ? t('Published') : t('Shared')}>
          <AdditionalIcon
            size={size}
            width={size}
            height={size}
            className={classNames(
              'stroke-1 p-[1px] text-accent-primary group-hover:bg-accent-primary-alpha',
              isHighlighted && 'bg-accent-primary-alpha',
              isPublished ? 'rounded-md' : 'rounded-sm',
              iconClassName,
            )}
          />
        </Tooltip>
      </div>
    </div>
  );
}
