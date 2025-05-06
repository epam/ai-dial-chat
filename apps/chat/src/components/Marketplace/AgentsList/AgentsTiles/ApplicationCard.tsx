import React, { memo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelShortDescription } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { CardIconSizes } from '@/src/constants/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import ShareIcon from '@/src/components/Common/ShareIcon';
import { AgentBookmark } from '@/src/components/Marketplace/AgentBookmark';
import { AgentContextMenu } from '@/src/components/Marketplace/AgentContextMenu';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';
import { TopicsList } from '@/src/components/Marketplace/TopicsList';

import { PublishActions } from '@epam/ai-dial-shared';

interface CardFooterProps {
  entity: DialAIEntityModel;
}

const CardFooter = ({ entity }: CardFooterProps) => {
  return (
    <>
      <EntityMarkdownDescription className="mt-3 hidden text-ellipsis text-sm leading-[18px] text-secondary md:line-clamp-2 xl:hidden">
        {getModelShortDescription(entity)}
      </EntityMarkdownDescription>
      <div className="flex flex-col gap-2 pt-3 md:pt-4">
        {/* <span className="text-sm leading-[21px] text-secondary">
        Capabilities: Conversation
      </span> */}

        <div className="w-full">
          {entity.topics && <TopicsList topics={entity.topics} />}
        </div>
      </div>
    </>
  );
};

interface ApplicationCardProps {
  entity: DialAIEntityModel;
  onClick: (entity: DialAIEntityModel) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onLogsClick?: (entity: DialAIEntityModel) => void;
  isPreview?: boolean;
  dataQA?: string;
}

export const ApplicationCard = memo(
  ({
    entity,
    onClick,
    onBookmarkClick,
    isPreview = false,
    dataQA,
  }: ApplicationCardProps) => {
    const { t } = useTranslation(Translation.Marketplace);

    const screenState = useScreenState();

    const isMyApp = isMyApplication(entity);
    const { iconSize, shareIconSize } = CardIconSizes[screenState];

    return (
      <div
        onClick={() => onClick(entity)}
        className={classNames(
          'group relative h-[98px] rounded-md bg-layer-2 p-3 shadow-card hover:bg-layer-3 md:h-[162px] md:p-4 xl:h-[164px] xl:p-5',
          !isPreview && 'cursor-pointer',
        )}
        data-qa="agent"
        aria-details={dataQA}
      >
        <div>
          <div className="absolute right-4 top-4 flex gap-1 xl:right-5 xl:top-5">
            {!isPreview && (
              <>
                <AgentContextMenu
                  isPreview={isPreview}
                  className="xl:invisible group-hover:xl:visible"
                  entity={entity}
                />
                <AgentBookmark
                  onBookmarkClick={onBookmarkClick}
                  entity={entity}
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="flex shrink-0 items-center justify-center xl:my-[3px]">
              <ShareIcon
                {...entity}
                isHighlighted={false}
                size={shareIconSize}
                featureType={FeatureType.Application}
                iconClassName="bg-layer-2 group-hover:bg-transparent"
                isMyEntity={isMyApp}
              >
                <ModelIcon
                  entityId={entity.id}
                  entity={entity}
                  size={iconSize}
                />
              </ShareIcon>
            </div>
            <div className="flex grow flex-col justify-center gap-2 overflow-hidden">
              {entity.version && (
                <div
                  className={classNames(
                    'mr-6 flex gap-1 text-xs leading-[14px] text-secondary',
                    !isMyApp && '!mr-12',
                  )}
                >
                  {t('Version: ')}
                  <span
                    className="max-w-full overflow-hidden truncate whitespace-nowrap"
                    data-qa="version"
                  >
                    {entity.version}
                  </span>
                </div>
              )}
              <div className="flex whitespace-nowrap">
                <div
                  className={classNames(
                    'mr-6 flex shrink truncate text-base font-semibold leading-[20px] text-primary',
                    !isMyApp && !entity.version && '!mr-12',
                  )}
                >
                  <span className="truncate" data-qa="agent-name">
                    {entity.name}
                  </span>
                  <FunctionStatusIndicator entity={entity} />
                </div>
              </div>
              <EntityMarkdownDescription className="hidden text-ellipsis text-sm leading-[18px] text-secondary xl:!line-clamp-2">
                {getModelShortDescription(entity)}
              </EntityMarkdownDescription>
            </div>
          </div>
        </div>
        <CardFooter entity={entity} />
      </div>
    );
  },
);
ApplicationCard.displayName = 'ApplicationCard';
