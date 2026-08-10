/* eslint-disable @next/next/no-img-element */
import {
  IconBlocks,
  IconHistoryToggle,
  IconMessage2,
} from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';
import { constructPath, isAbsoluteUrl } from '@/src/utils/app/file';
import { isApplicationId, isFileId, isToolsetId } from '@/src/utils/app/id';
import { getThemeIconUrl } from '@/src/utils/app/themes';
import { ApiUtils } from '@/src/utils/server/api';

import { EntityType } from '@/src/types/common';
import { DialAIEntity } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { DEFAULT_AGENT, LAST_USED_AGENT } from '@/src/constants/chat';
import {
  DEFAULT_MODEL_IMAGE,
  DEFAULT_TOOLSET_IMAGE,
} from '@/src/constants/themes';

import { Tooltip } from '@/src/components/Common/Tooltip';

const DEFAULT_ICON_RETRY = 2;

interface FallbackIconProps {
  entityType: string | undefined;
  size: number;
}

function FallbackIcon({ entityType, size }: FallbackIconProps) {
  const Icon = entityType === EntityType.Toolset ? IconBlocks : IconMessage2;
  return (
    <Icon
      size={Math.round(size / 1.25)}
      className="z-0 text-primary dark:invert"
      stroke={entityType === EntityType.Toolset ? 1.1 : 1.2}
    />
  );
}

interface ModelTooltipProps {
  entityId: string;
  entity: DialAIEntity | undefined;
}
export const ModelTooltip = ({ entity, entityId }: ModelTooltipProps) => {
  const locale = useAppSelector(UISelectors.selectLocale);

  const name = entity ? getOpenAIEntityFullName(entity, locale) : entityId;
  return entity?.version ? `${name}\nv. ${entity.version}` : name;
};
interface Props extends ModelTooltipProps {
  size: number;
  animate?: boolean;
  isCustomTooltip?: boolean;
  enableShrinking?: boolean;
  isTooltipDisabled?: boolean;
}

const ModelIconTemplate = memo(
  ({
    entity,
    size,
    animate,
    entityId,
    enableShrinking,
  }: Omit<Props, 'isCustomTooltip'>) => {
    const locale = useAppSelector(UISelectors.selectLocale);
    const themesImages = useAppSelector(UISelectors.selectThemesImages);
    const applicationTypeSchemas = useAppSelector(
      ApplicationTypesSchemasSelectors.selectAllSchemas,
    );
    const isThemeHostDefined = useAppSelector(
      SettingsSelectors.selectThemeHostDefined,
    );

    const [iconError, setIconError] = useState(false);
    const [iconRetry, setIconRetry] = useState(DEFAULT_ICON_RETRY);

    const ref = useRef<HTMLImageElement>(null);

    const entityTypeForFallback = useMemo(() => {
      if (entity) {
        return entity.type;
      }
      return isToolsetId(entityId) ? EntityType.Toolset : EntityType.Model;
    }, [entity, entityId]);

    const fallbackUrl = useMemo(() => {
      const defaultImageName =
        entityTypeForFallback === EntityType.Toolset
          ? DEFAULT_TOOLSET_IMAGE
          : DEFAULT_MODEL_IMAGE;

      return themesImages[defaultImageName]
        ? getThemeIconUrl(themesImages[defaultImageName])
        : null;
    }, [entityTypeForFallback, themesImages]);

    const description = entity
      ? getOpenAIEntityFullName(entity, locale)
      : entityId;

    const schemaApplicationFallbackUrl = useMemo(() => {
      const iconUrl = applicationTypeSchemas?.find(
        (schema) => schema.id === entity?.applicationTypeSchemaId,
      )?.iconUrl;
      if (!iconUrl) return null;
      return getThemeIconUrl(iconUrl);
    }, [applicationTypeSchemas, entity?.applicationTypeSchemaId]);

    const handleError = useCallback(() => {
      if (ref.current) {
        if (iconRetry > 0 && fallbackUrl) {
          setIconRetry((prev) => prev - 1);
        } else {
          setIconError(true);
        }
        if (fallbackUrl) {
          ref.current.src = fallbackUrl;
          ref.current.onerror = null;
        }
      }
    }, [fallbackUrl, iconRetry]);

    useEffect(() => {
      setIconError(false);
      setIconRetry(DEFAULT_ICON_RETRY);
    }, [entity?.iconUrl]);

    const iconUrl = useMemo(() => {
      if (!entity?.iconUrl) return schemaApplicationFallbackUrl ?? fallbackUrl;

      if (
        (isApplicationId(entity.id) || isToolsetId(entity.id)) &&
        isFileId(entity.iconUrl)
      ) {
        return constructPath('/api', ApiUtils.encodeApiUrl(entity.iconUrl));
      }

      const iconUrl = getThemeIconUrl(entity.iconUrl);
      if (!isAbsoluteUrl(iconUrl) && !isThemeHostDefined) {
        return null;
      }

      return `${iconUrl}?v2`;
    }, [
      entity?.iconUrl,
      entity?.id,
      fallbackUrl,
      isThemeHostDefined,
      schemaApplicationFallbackUrl,
    ]);

    if (entity?.id === LAST_USED_AGENT) {
      return <IconHistoryToggle size={size} className="text-secondary" />;
    }

    if (entity?.id === DEFAULT_AGENT) {
      return <IconMessage2 size={size} className="text-secondary" />;
    }

    const showFallback = iconError || !iconUrl;

    return (
      <span
        className={classNames(
          'relative shrink-0 overflow-hidden rounded-full leading-none',
          animate && 'animate-bounce',
          enableShrinking && 'shrink',
          showFallback ? 'flex items-center justify-center' : 'inline-block',
        )}
        style={{ height: `${size}px`, width: `${size}px` }}
        data-qa="entity-icon"
      >
        <div
          className="absolute z-0 size-full rounded-full border border-secondary bg-model-icon [-webkit-background-clip:padding-box]"
          style={{ height: `${size}px`, width: `${size}px` }}
        ></div>
        {showFallback ? (
          <FallbackIcon entityType={entityTypeForFallback} size={size} />
        ) : (
          <img
            key={entityId}
            src={iconUrl}
            width={size}
            height={size}
            onError={handleError}
            data-image-name={description}
            ref={ref}
            className="absolute start-0 top-0 z-10 size-full"
            style={{ height: `${size}px`, width: `${size}px` }}
            id={entityId}
          />
        )}
      </span>
    );
  },
);
ModelIconTemplate.displayName = 'ModelIconTemplate';

export const ModelIcon = ({
  entity,
  entityId,
  size,
  animate,
  isCustomTooltip,
  isTooltipDisabled,
}: Props) => {
  const icon = (
    <ModelIconTemplate
      entity={entity}
      entityId={entityId}
      size={size}
      animate={animate}
    />
  );
  return !isTooltipDisabled ? (
    <Tooltip
      hideTooltip={isCustomTooltip}
      tooltip={<ModelTooltip entity={entity} entityId={entityId} />}
      triggerClassName="flex shrink-0 relative select-none"
    >
      {icon}
    </Tooltip>
  ) : (
    icon
  );
};
