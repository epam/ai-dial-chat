import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { ShareInterface } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Tooltip from './Tooltip';

import ArrowUpRight from '@/public/images/icons/arrow-up-right.svg';
import World from '@/public/images/icons/world.svg';

interface ShareIconProps extends ShareInterface {
  isHighlighted: boolean;
  size?: number;
  children: ReactNode | ReactNode[];
  featureType: FeatureType;
  isInvalid?: boolean;
  containerClassName?: string;
}

export default function ShareIcon({
  isShared,
  isPublished,
  isHighlighted,
  size = 12,
  children,
  featureType,
  isInvalid,
  containerClassName,
}: ShareIconProps) {
  const { t } = useTranslation(Translation.SideBar);
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );
  const containerClass = classNames(
    'relative',
    isInvalid && 'text-secondary',
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
        )}
        data-qa={
          isPublished && isPublishingEnabled ? 'world-icon' : 'arrow-icon'
        }
      >
        <Tooltip tooltip={t(isPublished ? 'Published' : 'Shared')}>
          <AdditionalIcon
            size={size}
            width={size}
            height={size}
            className={classNames(
              'text-accent-primary group-hover:bg-accent-primary-alpha',
              'stroke-1 p-[1px]',
              isHighlighted && 'bg-accent-primary-alpha',
              isPublished ? 'rounded-md' : 'rounded-sm',
            )}
          />
        </Tooltip>
      </div>
    </div>
  );
}
