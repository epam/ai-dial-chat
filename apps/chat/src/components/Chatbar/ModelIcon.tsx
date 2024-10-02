import { memo } from 'react';
import SVG from 'react-inlinesvg';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';
import { constructPath } from '@/src/utils/app/file';
import { isApplicationId } from '@/src/utils/app/id';
import { getThemeIconUrl } from '@/src/utils/app/themes';

import { EntityType } from '@/src/types/common';
import { DialAIEntity } from '@/src/types/models';

import Tooltip from '@/src/components/Common/Tooltip';

interface Props {
  entityId: string;
  entity: DialAIEntity | undefined;
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
    const fallbackUrl =
      entity?.type === EntityType.Addon
        ? getThemeIconUrl('default-addon')
        : getThemeIconUrl('default-model');
    const description = entity ? getOpenAIEntityFullName(entity) : entityId;

    const getIconUrl = (entity: DialAIEntity | undefined) => {
      if (!entity?.iconUrl) return fallbackUrl;

      if (isApplicationId(entity.id)) {
        return constructPath('api', entity.iconUrl);
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
        <SVG
          key={entityId}
          src={getIconUrl(entity)}
          width={size}
          height={size}
          description={description}
        >
          <SVG
            src={fallbackUrl}
            width={size}
            height={size}
            description={description}
          />
        </SVG>
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
      tooltip={entity ? getOpenAIEntityFullName(entity) : entityId}
      triggerClassName="flex shrink-0 relative"
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
