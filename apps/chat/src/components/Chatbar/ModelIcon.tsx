/* eslint-disable jsx-a11y/alt-text */

/* eslint-disable @next/next/no-img-element */
import { IconHistoryToggle, IconMessage2 } from '@tabler/icons-react';
import { memo, useCallback, useMemo, useRef } from 'react';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';
import { constructPath } from '@/src/utils/app/file';
import { isApplicationId } from '@/src/utils/app/id';
import { getThemeIconUrl } from '@/src/utils/app/themes';
import { ApiUtils } from '@/src/utils/server/api';

import { EntityType } from '@/src/types/common';
import { DialAIEntity } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationTypesSchemasSelectors } from '@/src/store/selectors';

import { DEFAULT_AGENT, LAST_USED_AGENT } from '@/src/constants/chat';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface ModelTooltipProps {
  entityId: string;
  entity: DialAIEntity | undefined;
}
export const ModelTooltip = ({ entity, entityId }: ModelTooltipProps) => {
  const name = entity ? getOpenAIEntityFullName(entity) : entityId;
  return entity?.version ? `${name}\nv. ${entity.version}` : name;
};
interface Props extends ModelTooltipProps {
  size: number;
  animate?: boolean;
  isCustomTooltip?: boolean;
  enableShrinking?: boolean;
}

const ModelIconTemplate = memo(
  ({
    entity,
    size,
    animate,
    entityId,
    enableShrinking,
  }: Omit<Props, 'isCustomTooltip'>) => {
    const ref = useRef<HTMLImageElement>(null);
    const fallbackUrl =
      entity?.type === EntityType.Addon
        ? getThemeIconUrl('default-addon')
        : getThemeIconUrl('default-model');
    const description = entity ? getOpenAIEntityFullName(entity) : entityId;
    const applicationTypeSchemas = useAppSelector(
      ApplicationTypesSchemasSelectors.selectAllSchemas,
    );

    const schemaApplicationFallbackUrl = useMemo(() => {
      const iconUrl = applicationTypeSchemas?.find(
        (schema) => schema.id === entity?.applicationTypeSchemaId,
      )?.iconUrl;
      if (!iconUrl) return null;
      return getThemeIconUrl(iconUrl);
    }, [applicationTypeSchemas, entity?.applicationTypeSchemaId]);

    const handleError = useCallback(() => {
      if (ref.current) {
        ref.current.src = fallbackUrl;
        ref.current.onerror = null;
      }
    }, [fallbackUrl]);

    if (entity?.id === LAST_USED_AGENT) {
      return <IconHistoryToggle size={size} className="text-secondary" />;
    }

    if (entity?.id === DEFAULT_AGENT) {
      return <IconMessage2 size={size} className="text-secondary" />;
    }

    const getIconUrl = (entity: DialAIEntity | undefined) => {
      if (!entity?.iconUrl) return schemaApplicationFallbackUrl ?? fallbackUrl;

      if (isApplicationId(entity.id)) {
        return constructPath('/api', ApiUtils.encodeApiUrl(entity.iconUrl));
      }

      return `${getThemeIconUrl(entity.iconUrl)}?v2`;
    };

    return (
      <span
        className={classNames(
          'relative inline-block shrink-0 bg-model-icon leading-none',
          entity?.type !== EntityType.Addon && 'overflow-hidden rounded-full',
          animate && 'animate-bounce',
          enableShrinking && 'shrink',
        )}
        style={{ height: `${size}px`, width: `${size}px` }}
        data-qa="entity-icon"
      >
        <img
          key={entityId}
          src={getIconUrl(entity)}
          width={size}
          height={size}
          onError={handleError}
          data-image-name={description}
          ref={ref}
          style={{ height: `${size}px`, width: `${size}px` }}
          id={entityId}
        />
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
}: Props) => {
  return (
    <Tooltip
      hideTooltip={isCustomTooltip}
      tooltip={<ModelTooltip entity={entity} entityId={entityId} />}
      triggerClassName="flex shrink-0 relative select-none"
      contentClassName="max-w-[300px] break-words"
    >
      <ModelIconTemplate
        entity={entity}
        entityId={entityId}
        size={size}
        animate={animate}
      />
    </Tooltip>
  );
};
