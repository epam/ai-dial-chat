import { memo } from 'react';
import SVG from 'react-inlinesvg';

import classNames from 'classnames';

import { EntityType } from '@/src/types/common';
import { OpenAIEntity } from '@/src/types/openai';

import Tooltip from '@/src/components/Common/Tooltip';

interface Props {
  entityId: string;
  entity: OpenAIEntity | undefined;
  size: number;
  animate?: boolean;
  isCustomTooltip?: boolean;
}

const ModelIconTemplate = memo(
  ({ entity, size, animate }: Omit<Props, 'isCustomTooltip'>) => {
    const url =
      entity?.iconUrl ??
      (entity?.type === EntityType.Addon
        ? `api/themes/image?name=default-addon`
        : `api/themes/image?name=default-model`);

    return (
      <>
        <span
          className={classNames(
            'relative inline-block shrink-0 leading-none text-primary',
            animate && 'animate-bounce',
          )}
          style={{ height: `${size}px`, width: `${size}px` }}
        >
          <SVG src={url} width={size} height={size} />
        </span>
      </>
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
    <>
      {isCustomTooltip ? (
        <ModelIconTemplate
          entity={entity}
          entityId={entityId}
          size={size}
          animate={animate}
        />
      ) : (
        <Tooltip
          tooltip={entity?.name || entityId}
          triggerClassName="flex shrink-0"
        >
          <ModelIconTemplate
            entity={entity}
            entityId={entityId}
            size={size}
            animate={animate}
          />
        </Tooltip>
      )}
    </>
  );
};
