import { memo } from 'react';
import SVG from 'react-inlinesvg';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntity } from '@/src/types/models';

import Tooltip from '@/src/components/Common/Tooltip';

interface Props {
  entityId: string;
  entity: DialAIEntity | undefined;
  size: number;
  animate?: boolean;
  isCustomTooltip?: boolean;
}

const ModelIconTemplate = memo(
  ({ entity, size, animate, entityId }: Omit<Props, 'isCustomTooltip'>) => {
    const fallbackUrl =
      entity?.type === EntityType.Addon
        ? `api/themes/image?name=default-addon`
        : `api/themes/image?name=default-model`;
    const description = entity ? getOpenAIEntityFullName(entity) : entityId;

    return (
      <span
        className={classNames(
          'relative inline-block shrink-0 leading-none text-primary',
          animate && 'animate-bounce',
        )}
        style={{ height: `${size}px`, width: `${size}px` }}
      >
        <SVG
          key={entityId}
          src={entity?.iconUrl ? `${entity.iconUrl}?v2` : ''}
          className={classNames(!entity?.iconUrl && 'hidden')}
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
