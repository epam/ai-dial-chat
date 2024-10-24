import {
  IconBookmark,
  IconBookmarkFilled,
  IconDotsVertical,
  IconPencilMinus,
  IconTrashX,
  IconWorldShare,
  TablerIconsProps,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { getModelShortDescription } from '@/src/utils/app/application';
import { getRootId } from '@/src/utils/app/id';
import { isMediumScreen } from '@/src/utils/app/mobile';
import { isEntityPublic } from '@/src/utils/app/publications';

import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import ContextMenu from '@/src/components/Common/ContextMenu';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ApplicationTopic } from '@/src/components/Marketplace/ApplicationTopic';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { PublishActions } from '@epam/ai-dial-shared';

const DESKTOP_ICON_SIZE = 80;
const SMALL_ICON_SIZE = 48;

interface CardFooterProps {
  entity: DialAIEntityModel;
}

const CardFooter = ({ entity }: CardFooterProps) => {
  return (
    <>
      <EntityMarkdownDescription className="mt-3 line-clamp-2 text-ellipsis text-sm leading-[18px] text-secondary xl:hidden">
        {getModelShortDescription(entity)}
      </EntityMarkdownDescription>
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
  isNotDesktop?: boolean;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
}

export const ApplicationCard = ({
  entity,
  onClick,
  onDelete,
  onEdit,
  isNotDesktop,
  onBookmarkClick,
  onPublish,
}: ApplicationCardProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

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
    ],
    [entity, onPublish, t, onDelete, isMyEntity, onEdit],
  );

  const iconSize =
    isNotDesktop ?? isMediumScreen() ? SMALL_ICON_SIZE : DESKTOP_ICON_SIZE;
  const Bookmark = installedModelIds.has(entity.reference)
    ? IconBookmarkFilled
    : IconBookmark;

  return (
    <div
      onClick={() => onClick(entity)}
      className="relative h-[162px] cursor-pointer rounded-md bg-layer-2 p-4 shadow-card hover:bg-layer-3 xl:h-[164px] xl:p-5"
      data-qa="application"
    >
      <div>
        <div className="absolute right-4 top-4 flex gap-1 xl:right-5 xl:top-5">
          <ContextMenu
            menuItems={menuItems}
            featureType={FeatureType.Application}
            triggerIconClassName="group rounded"
            TriggerCustomRenderer={
              <IconDotsVertical
                onClick={(e) => e.stopPropagation()}
                size={18}
                className="stroke-primary group-hover:stroke-accent-primary"
              />
            }
            className="m-0"
          />
          {!isMyEntity && (
            <Bookmark
              onClick={(e) => {
                e.stopPropagation();
                onBookmarkClick?.(entity);
              }}
              className="rounded text-secondary hover:text-accent-primary"
              size={18}
            />
          )}
        </div>
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex shrink-0 items-center justify-center xl:my-[3px]">
            <ModelIcon entityId={entity.id} entity={entity} size={iconSize} />
          </div>
          <div className="flex grow flex-col justify-center gap-2 overflow-hidden">
            {entity.version && (
              <div className="text-xs leading-[14px] text-secondary">
                {t('Version: ')}
                {entity.version}
              </div>
            )}
            <h2
              className="truncate text-base font-semibold leading-[20px] text-primary"
              data-qa="application-name"
            >
              {entity.name}
            </h2>
            <EntityMarkdownDescription className="hidden text-ellipsis text-sm leading-[18px] text-secondary xl:!line-clamp-2">
              {getModelShortDescription(entity)}
            </EntityMarkdownDescription>
          </div>
        </div>
      </div>

      <CardFooter entity={entity} />
    </div>
  );
};
