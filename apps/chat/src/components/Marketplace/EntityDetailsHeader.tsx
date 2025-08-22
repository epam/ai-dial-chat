import { IconUserShare } from '@tabler/icons-react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { HeaderIconSizes } from '@/src/constants/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ShareIcon } from '@/src/components/Common/ShareIcon';

import { TopicsList } from './TopicsList';

import { FeatureType } from '@epam/ai-dial-shared';

interface EntityHeaderProps<T> {
  entity: T;
  featureType: FeatureType;
  isMyEntity: boolean;
  isExternal?: boolean;
  isPreview?: boolean;
  // Optional action buttons
  shareAction?: {
    isEnabled: boolean;
    onShare: () => void;
  };
  copyLinkAction?: {
    isPublic: boolean;
    Component: React.ComponentType<{ entity: T; withText: boolean }>;
  };
  // Optional custom components
  StatusIndicator?: React.ComponentType<{ entity: T }>;
  dataQa?: string;
}

export function EntityHeader<T extends MarketplaceEntity>({
  entity,
  featureType,
  isMyEntity,
  isExternal,
  isPreview = false,
  shareAction,
  copyLinkAction,
  StatusIndicator,
  dataQa = 'entity-header',
}: EntityHeaderProps<T>) {
  const { t } = useTranslation(Translation.Marketplace);

  const screenState = useScreenState();
  const { iconSize, shareIconSize } = HeaderIconSizes[screenState];

  const isShareVisible =
    !!shareAction?.isEnabled &&
    isMyEntity &&
    screenState !== ScreenState.SM &&
    !isPreview;

  const isCopyLinkVisible =
    !!copyLinkAction?.isPublic && screenState !== ScreenState.SM && !isPreview;

  return (
    <header
      className="flex items-start justify-between px-3 py-4 md:p-6"
      data-qa={dataQa}
    >
      <div className="flex w-full items-center gap-2 overflow-hidden md:gap-4">
        <ShareIcon
          {...entity}
          isHighlighted={false}
          size={shareIconSize}
          featureType={featureType}
          iconClassName="bg-layer-3"
          isMyEntity={isMyEntity}
          isExternal={isExternal}
        >
          <ModelIcon
            enableShrinking
            isCustomTooltip
            entity={entity}
            entityId={entity.id}
            size={iconSize}
          />
        </ShareIcon>

        <div className="flex min-w-0 shrink grow flex-col justify-center gap-1 md:gap-3">
          <div className="flex shrink-0 justify-between">
            <div
              className={classNames(
                'flex w-full flex-col',
                entity.topics?.length ? 'gap-2' : '',
              )}
            >
              {entity.topics && (
                <TopicsList
                  topics={entity.topics}
                  counterMarginRight={screenState === ScreenState.SM ? 18 : 0}
                />
              )}
              <div className="flex items-center gap-[2px] whitespace-nowrap">
                <div
                  className="shrink truncate text-lg font-semibold leading-[18px] md:text-xl md:leading-6"
                  data-qa="entity-name"
                >
                  {entity.name}
                </div>
                {StatusIndicator && <StatusIndicator entity={entity} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {isShareVisible && (
        <button
          className="flex gap-2 px-3 py-1.5 text-sm text-accent-primary"
          onClick={shareAction.onShare}
        >
          <IconUserShare size={18} />
          <span>{t('Share')}</span>
        </button>
      )}

      {isCopyLinkVisible && (
        <copyLinkAction.Component entity={entity} withText />
      )}
    </header>
  );
}
