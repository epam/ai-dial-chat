import { ReactNode } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import { ShareInterface } from '@/src/types/share';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ArrowUpRight from '@/public/images/icons/arrow-up-right.svg';
import World from '@/public/images/icons/world.svg';

interface ShareIsonProps extends ShareInterface {
  isHighlited: boolean;
  highlightColor: HighlightColor;
  size?: number;
  children: ReactNode | ReactNode[];
  featureType: FeatureType;
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
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isSharingEnabled = enabledFeatures.has(
    featureType === FeatureType.Chat
      ? Feature.ConversationsSharing
      : Feature.PromptsSharing,
  );
  const isPublishingEnabled = enabledFeatures.has(
    featureType === FeatureType.Chat
      ? Feature.ConversationsPublishing
      : Feature.PromptsPublishing,
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
          'absolute bottom-[-4px] left-[-4px] bg-gray-100 dark:bg-gray-700',
          isPublished ? 'rounded-md' : 'rounded-sm',
        )}
      >
        <AdditionalIcon
          size={size}
          width={size}
          height={size}
          className={classNames(
            getByHighlightColor(
              highlightColor,
              'text-green group-hover:bg-green/15',
              'text-violet group-hover:bg-violet/15',
              'text-blue-500 group-hover:bg-blue-500/20',
            ),
            'stroke-1 p-[1px]',
            isHighlited &&
              getByHighlightColor(
                highlightColor,
                'bg-green/15',
                'bg-violet/15',
                'bg-blue-500/20',
              ),
          )}
        />
      </div>
    </div>
  );
}
