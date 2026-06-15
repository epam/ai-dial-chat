import { IconExternalLink, IconPencil } from '@tabler/icons-react';
import { ReactNode, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { SideBarI18nKeys } from '@/src/constants/i18n';

import { Tooltip } from './Tooltip';

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
  isExternal?: boolean;
  isDraggingOver?: boolean;
}

export function ShareIcon({
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
  isExternal,
  isDraggingOver,
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

  const isMyEntityIcon = isMyEntity && !isPublished && !isShared;

  const [AdditionalIcon, dataQA, tooltip] = useMemo(() => {
    if (isPublished && isPublishingEnabled)
      return [World, 'world-icon', SideBarI18nKeys.Published] as const;
    if (isExternal)
      return [
        IconExternalLink,
        'external-icon',
        SideBarI18nKeys.ExternalApplication,
      ] as const;
    if (isShared)
      return [ArrowUpRight, 'arrow-icon', SideBarI18nKeys.Shared] as const;
    return [IconPencil, 'pencil-icon', SideBarI18nKeys.CreatedByMe] as const;
  }, [isPublished, isPublishingEnabled, isExternal, isShared]);

  if (
    (!isSharingEnabled || !isShared) &&
    (!isPublishingEnabled || !isPublished) &&
    !isMyEntity &&
    !isExternal
  ) {
    return (
      <div className={containerClass} data-qa="icon-container">
        {children}
      </div>
    );
  }

  return (
    <div className={containerClass} data-qa="icon-container">
      {children}
      <div
        className={classNames(
          'absolute z-50 bg-layer-3',
          isPublished && 'rounded-md',
          isApplication
            ? 'bottom-0 start-0 rounded-none rounded-se-[4px] stroke-[0.6]'
            : '-bottom-1 -start-1 rounded-sm stroke-[1.5]',
          iconWrapperClassName,
        )}
        data-qa={dataQA}
      >
        <Tooltip tooltip={t(tooltip)}>
          <AdditionalIcon
            size={size}
            width={size}
            height={size}
            className={classNames(
              'p-px text-accent-primary group-hover:bg-accent-primary-alpha',
              (isHighlighted || isDraggingOver) && 'bg-accent-primary-alpha',
              isPublished && '!rounded-md',
              isApplication
                ? 'rounded-none rounded-se-[4px] stroke-[0.6]'
                : 'rounded-sm stroke-[1.5]',
              (isExternal || isMyEntityIcon) && '!stroke-[1.5]',
              iconClassName,
            )}
          />
        </Tooltip>
      </div>
    </div>
  );
}
