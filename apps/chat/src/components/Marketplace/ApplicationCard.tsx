import {
  IconDotsVertical,
  IconPencilMinus,
  IconTrashX,
  IconWorldShare,
  TablerIconsProps,
} from '@tabler/icons-react';
import React, { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getModelShortDescription } from '@/src/utils/app/application';
import { getRootId } from '@/src/utils/app/id';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { isEntityPublic } from '@/src/utils/app/publications';

import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import ContextMenu from '@/src/components/Common/ContextMenu';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ApplicationTopic } from '@/src/components/Marketplace/ApplicationTopic';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { PublishActions } from '@epam/ai-dial-shared';

const DESKTOP_ICON_SIZE = 80;
const SMALL_ICON_SIZE = 48;

interface CardDescriptionProps {
  entity: DialAIEntityModel;
  isMobile: boolean;
}

const CardDescription = ({ entity, isMobile }: CardDescriptionProps) => {
  return (
    <EntityMarkdownDescription
      className={classNames(
        'line-clamp-2 text-ellipsis text-sm leading-[18px] text-secondary',
        isMobile && 'mt-3',
      )}
    >
      {getModelShortDescription(entity)}
    </EntityMarkdownDescription>
  );
};

interface CardFooterProps {
  entity: DialAIEntityModel;
  isMobile: boolean;
}

const CardFooter = ({ entity, isMobile }: CardFooterProps) => {
  return (
    <>
      {isMobile && <CardDescription isMobile={isMobile} entity={entity} />}
      <div className="flex flex-col gap-2 pt-3 md:pt-4">
        {/* <span className="text-sm leading-[21px] text-secondary">
        Capabilities: Conversation
      </span> */}

        <div className="flex gap-2 overflow-hidden">
          {entity.topics?.map((topic) => (
            <ApplicationTopic key={topic} topic={topic} />
          ))}
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
  onRemove?: (entity: DialAIEntityModel) => void;
  isMobile?: boolean;
}

export const ApplicationCard = ({
  entity,
  onClick,
  onDelete,
  onEdit,
  onRemove,
  isMobile,
  onPublish,
}: ApplicationCardProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const isMyEntity = entity.id.startsWith(
    getRootId({ featureType: FeatureType.Application }),
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: isMyEntity && !!onEdit,
        Icon: IconPencilMinus,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onEdit?.(entity);
        },
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isMyEntity && !!onPublish,
        Icon: IconWorldShare,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onPublish?.(entity, PublishActions.ADD);
        },
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isEntityPublic(entity) && !!onPublish,
        Icon: UnpublishIcon,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onPublish?.(entity, PublishActions.DELETE);
        },
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyEntity && !!onDelete,
        Icon: (props: TablerIconsProps) => (
          <IconTrashX {...props} className="stroke-error" />
        ),
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete?.(entity);
        },
      },
      {
        name: t('Remove'),
        dataQa: 'remove',
        display:
          !isMyEntity &&
          selectedTab === MarketplaceTabs.MY_APPLICATIONS &&
          !!onRemove,
        Icon: (props: TablerIconsProps) => (
          <IconTrashX {...props} className="stroke-error" />
        ),
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onRemove?.(entity);
        },
      },
    ],
    [entity, onPublish, t, selectedTab, onDelete, isMyEntity, onEdit, onRemove],
  );

  const iconSize =
    isMobile ?? isSmallScreen() ? SMALL_ICON_SIZE : DESKTOP_ICON_SIZE;

  return (
    <div
      onClick={() => onClick(entity)}
      className="relative cursor-pointer rounded-md bg-layer-2 p-5 shadow-sm hover:bg-layer-3 lg:h-[164px]"
      data-qa="application"
    >
      <div>
        <div className="group absolute right-4 top-4 rounded py-px hover:bg-accent-primary-alpha">
          <ContextMenu
            menuItems={menuItems}
            featureType={FeatureType.Application}
            TriggerCustomRenderer={
              <IconDotsVertical
                onClick={(e) => e.stopPropagation()}
                size={18}
                className="stroke-primary group-hover:stroke-accent-primary"
              />
            }
            className="m-0"
          />
        </div>
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex shrink-0 items-center justify-center">
            <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
          </div>
          <div className="flex grow flex-col justify-center gap-2 overflow-hidden">
            {entity.version && (
              <div className="text-xs leading-[14px] text-secondary">
                {entity.version}
              </div>
            )}
            <h2
              className="truncate text-base font-semibold leading-[20px] text-primary"
              data-qa="application-name"
            >
              {entity.name}
            </h2>
            {!isMobile && (
              <CardDescription entity={entity} isMobile={!!isMobile} />
            )}
          </div>
        </div>
      </div>

      <CardFooter isMobile={!!isMobile} entity={entity} />
    </div>
  );
};
