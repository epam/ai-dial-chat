import { memo, useMemo } from 'react';
import SVG from 'react-inlinesvg';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntity } from '@/src/types/models';

import Tooltip from '@/src/components/Common/Tooltip';
import {
  MODEL_ICON_SIZE,
  MODEL_ICON_SIZE_DEFAULT,
  ModelId
} from "@/src/constants/chat";

interface Props {
  entityId: string;
  entity: DialAIEntity | undefined;
  size: number;
  animate?: boolean;
  isCustomTooltip?: boolean;
  isInvalid?: boolean;
  isSmallIconSize?: boolean;
  boxSize?: number;
}

const ModelIconTemplate = memo(
  ({
    entity,
    size,
    animate,
    entityId,
    isInvalid,
    boxSize = MODEL_ICON_SIZE_DEFAULT.small,
  }: Omit<Props, 'isCustomTooltip'>) => {
    const fallbackUrl =
      entity?.type === EntityType.Addon
        ? 'api/themes/image?name=default-addon'
        : 'api/themes/image?name=default-model';
    const description = entity ? getOpenAIEntityFullName(entity) : entityId;

    return (
      <span
        className={classNames(
          'model-icon-template relative inline-block shrink-0 leading-none',
          isInvalid ? 'text-secondary-bg-dark' : 'text-primary-bg-dark',
          animate && 'animate-bounce',
        )}
        style={{  width: `${boxSize}px` }}
      >
        <SVG
          key={entityId}
          src={entity?.iconUrl ? `${entity.iconUrl}?v2` : ''}
          className={classNames(!entity?.iconUrl && 'hidden')}
          width={size}
          height='auto'
          description={description}
        >
          <SVG
            src={fallbackUrl}
            width={size}
            height='auto'
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
  animate,
  isCustomTooltip,
  isInvalid,
  isSmallIconSize = true
}: Props) => {
  const modelIconWidth = isSmallIconSize ? MODEL_ICON_SIZE.small : MODEL_ICON_SIZE.large;
  const modelIconWidthDefault = isSmallIconSize ? MODEL_ICON_SIZE_DEFAULT.small : MODEL_ICON_SIZE_DEFAULT.large

  const iconSize = useMemo(
    () =>
      modelIconWidth?.[entityId as ModelId] || modelIconWidthDefault,
    [entityId, isSmallIconSize],
  );

  return (
    <Tooltip
      hideTooltip={isCustomTooltip}
      tooltip={entity ? getOpenAIEntityFullName(entity) : entityId}
      triggerClassName="flex shrink-0 relative"
    >
      <ModelIconTemplate
        entity={entity}
        entityId={entityId}
        size={iconSize}
        boxSize={modelIconWidthDefault}
        animate={animate}
        isInvalid={isInvalid}
      />
    </Tooltip>
  );
};
