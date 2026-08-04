import { useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isCreatedMarketplaceEntity } from '@/src/utils/app/marketplace';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { FeatureType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import { stopBubbling } from '@/src/constants/chat';
import { ChatI18nKeys, MarketplaceI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';
import { NA_VERSION } from '@/src/constants/publication';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import { ShareIcon } from '@/src/components/Common/ShareIcon';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

const VersionPrefix = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="mr-2 flex items-center">
      <span className="hidden md:block">{t(ChatI18nKeys.VersionColon)}</span>
      <span className="md:hidden">{t(ChatI18nKeys.VersionPrefixShort)}</span>
    </div>
  );
};

const getDisplayValue = <T extends MarketplaceEntity>(entity: T) => {
  if (isCreatedMarketplaceEntity(entity) || entity.version) {
    return entity.version || NA_VERSION;
  }
  return entity.id;
};

const getUniqueVersionEntities = <T extends MarketplaceEntity>(
  entities: T[],
  currentEntity: T,
): T[] => {
  const getVersionKey = (entity: T) =>
    entity.version && entity.version !== NA_VERSION
      ? entity.version
      : NA_VERSION;

  const currentVersionKey = getVersionKey(currentEntity);
  const hasCurrentEntity = entities.some((e) => e.id === currentEntity.id);
  const seenVersions = new Set<string>();

  return entities.filter((entity) => {
    const versionKey = getVersionKey(entity);

    if (
      hasCurrentEntity &&
      versionKey === currentVersionKey &&
      entity.id !== currentEntity.id
    ) {
      return false;
    }

    if (seenVersions.has(versionKey)) {
      return false;
    }

    seenVersions.add(versionKey);
    return true;
  });
};
interface EntityVersionSelectProps<T extends MarketplaceEntity> {
  entities: T[];
  currentEntity: T;
  className?: string;
  showVersionPrefix?: boolean;
  readonly?: boolean;
  onSelect: (entity: T) => void;
  triggerClassName?: string;
  selectedBaseIdsSet?: Set<string>;
}

export const ModelVersionSelect = <T extends MarketplaceEntity>({
  entities,
  currentEntity,
  className,
  showVersionPrefix = false,
  readonly = false,
  onSelect,
  triggerClassName,
  selectedBaseIdsSet,
}: EntityVersionSelectProps<T>) => {
  const { t } = useTranslation(Translation.Marketplace);
  const userName = useAppSelector(AuthSelectors.selectUserName);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (entity: T) => {
    onSelect(entity);
    setIsOpen(false);
  };

  const uniqueEntities = useMemo(
    () => getUniqueVersionEntities(entities, currentEntity),
    [entities, currentEntity],
  );

  if (uniqueEntities.length < 2) {
    if (
      uniqueEntities.length &&
      (isCreatedMarketplaceEntity(uniqueEntities[0]) ||
        uniqueEntities[0].version)
    ) {
      return (
        <div
          className={classNames('flex truncate font-theme text-sm', className)}
        >
          {showVersionPrefix && <VersionPrefix />}
          <span
            className="max-w-full overflow-hidden truncate whitespace-nowrap"
            data-qa="version"
          >
            <DialEllipsisTooltip
              text={uniqueEntities[0].version ?? t(MarketplaceI18nKeys.NA)}
            />
          </span>
        </div>
      );
    }

    return null;
  }

  return (
    <Menu
      className={className}
      type="contextMenu"
      placement="bottom-end"
      onOpenChange={setIsOpen}
      listClassName="z-[2000]"
      enableAncestorScroll
      data-qa="model-version-select"
      trigger={
        <div
          className={classNames(
            'flex cursor-pointer items-center justify-between font-theme text-sm',
            triggerClassName,
          )}
          data-qa="agent-version-select-trigger"
          data-model-versions
          onClick={stopBubbling}
        >
          {showVersionPrefix && <VersionPrefix />}
          <span
            className="max-w-full overflow-hidden truncate whitespace-nowrap"
            data-qa="version"
          >
            {getDisplayValue(currentEntity)}
          </span>
          <ChevronDownIcon
            className={classNames(
              'ml-1 shrink-0 text-primary transition-all',
              isOpen && 'rotate-180',
            )}
            width={18}
            height={18}
          />
        </div>
      }
    >
      {uniqueEntities.map((entity) => (
        <MenuItem
          key={entity.id}
          className={classNames(
            'max-w-[350px] overflow-hidden text-nowrap border-l hover:bg-accent-primary-alpha',
            currentEntity.id === entity.id || selectedBaseIdsSet?.has(entity.id)
              ? '!border-accent-primary bg-accent-primary-alpha'
              : '!border-transparent',
          )}
          item={
            <div className="flex w-full items-center gap-2 overflow-hidden">
              <ShareIcon
                {...entity}
                isPublished={
                  (userName === entity.author || userName === entity.owner) &&
                  isEntityIdPublic(entity)
                }
                isHighlighted={false}
                size={10}
                featureType={FeatureType.Application}
                containerClassName="flex shrink-0"
              >
                <ModelIcon
                  entityId={entity.id}
                  entity={entity}
                  size={DEFAULT_ICON_SIZES.SMALL}
                />
              </ShareIcon>
              <span className="min-w-0 flex-1">
                <DialEllipsisTooltip
                  text={getDisplayValue(entity)}
                  contentClassName="!z-[10000]"
                />
              </span>
            </div>
          }
          disabled={readonly}
          value={entity.id}
          onClick={(e) => {
            e.stopPropagation();
            handleChange(entity);
          }}
          data-model-versions
          data-qa="model-version-option"
        />
      ))}
    </Menu>
  );
};
