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
import { ApplicationTag } from '@/src/components/Marketplace/ApplicationTag';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { PublishActions } from '@epam/ai-dial-shared';

const DESKTOP_ICON_SIZE = 96;
const SMALL_ICON_SIZE = 56;

export const Divider = () => <div className="my-3 border border-secondary" />;

export const CardFooter = () => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-[21px] text-secondary">
        Capabilities: Conversation
      </span>

      <div className="flex gap-2 overflow-hidden">
        <ApplicationTag tag="Development" />
        <ApplicationTag tag="SDLC" />
        <ApplicationTag tag="SQL" />
      </div>
    </div>
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
  selected?: boolean;
}

export const ApplicationCard = ({
  entity,
  onClick,
  onDelete,
  onEdit,
  onRemove,
  isMobile,
  selected,
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
        display: selectedTab === MarketplaceTabs.MY_APPLICATIONS && !!onRemove,
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
      className={classNames(
        'relative cursor-pointer rounded border border-primary p-3 hover:border-hover',
        {
          '!border-accent-primary': selected,
        },
      )}
      data-qa="application"
    >
      <div className="group absolute right-3 top-3 rounded py-[1px] hover:bg-accent-primary-alpha">
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

      <div className="mb-2 flex h-[68px] items-center gap-2 overflow-hidden md:mb-3 md:h-[108px] md:gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center md:size-24">
          <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
        </div>
        <div className="flex grow flex-col justify-center overflow-hidden">
          <h2
            className="truncate text-base font-semibold leading-4 text-primary md:mb-1"
            data-qa="application-name"
          >
            {entity.name}
          </h2>
          <EntityMarkdownDescription className="invisible line-clamp-2 size-0 text-ellipsis text-sm text-secondary md:visible md:size-auto">
            {entity.description ?? ''}
          </EntityMarkdownDescription>
        </div>
      </div>

      {/*{!isMobile && (*/}
      {/*  <>*/}
      {/*    <Divider />*/}
      {/*    <CardFooter />*/}
      {/*  </>*/}
      {/*)}*/}
    </div>
  );
};
