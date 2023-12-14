import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { ShareInterface } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Tooltip from './Tooltip';

import ArrowUpRight from '@/public/images/icons/arrow-up-right.svg';
import World from '@/public/images/icons/world.svg';

interface ShareIsonProps extends ShareInterface {
  isHighlited: boolean;
  highlightColor: HighlightColor;
  size?: number;
  children: ReactNode | ReactNode[];
  featureType?: FeatureType;
}

export default function ShareIcon({
  isShared,
  isPublished,
  isHighlited,
  highlightColor,
  size = 12,
  children,
  featureType,
}: ShareIsonProps) {
  const { t } = useTranslation(Translation.SideBar);
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );

  if (
    (!isSharingEnabled || !isShared) &&
    (!isPublishingEnabled || !isPublished)
  ) {
    return <>{children}</>;
  }

  const AdditionalIcon =
    isPublished && isPublishingEnabled ? World : ArrowUpRight;

  return (
    <div className="relative">
      {children}
      <div
        className={classNames(
          'absolute -bottom-1 -left-1 bg-layer-3',
          isPublished ? 'rounded-md' : 'rounded-sm',
        )}
      >
        <Tooltip tooltip={t(isPublished ? 'Published' : 'Shared')}>
          <AdditionalIcon
            size={size}
            width={size}
            height={size}
            className={classNames(
              getByHighlightColor(
                highlightColor,
                'text-accent-secondary group-hover:bg-accent-secondary',
                'text-accent-tertiary group-hover:bg-accent-tertiary',
                'text-accent-primary group-hover:bg-accent-primary',
              ),
              'stroke-1 p-[1px]',
              isHighlited &&
                getByHighlightColor(
                  highlightColor,
                  'bg-accent-secondary',
                  'bg-accent-tertiary',
                  'bg-accent-primary',
                ),
            )}
          />
        </Tooltip>
      </div>
    </div>
  );
}
