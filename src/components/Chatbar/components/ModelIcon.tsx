import { memo } from 'react';

import Image from 'next/image';

import { EntityType } from '@/src/types/common';
import { OpenAIEntity } from '@/src/types/openai';

import Tooltip from '@/src/components/Common/Tooltip';

interface Props {
  entityId: string;
  entity: OpenAIEntity | undefined;
  size: number;
  inverted?: boolean;
  animate?: boolean;
  isCustomTooltip?: boolean;
}

const ModelIconTemplate = memo(
  ({
    entity,
    entityId,
    size,
    animate,
    inverted,
  }: Omit<Props, 'isCustomTooltip'>) => {
    return (
      <>
        {entity?.iconUrl != null ? (
          <span
            className={`relative inline-block shrink-0 leading-none ${
              animate ? 'animate-bounce' : ''
            }`}
            style={{ height: `${size}px`, width: `${size}px` }}
          >
            <Image
              className={`${
                inverted && entity.type !== EntityType.Addon ? 'invert' : ''
              } `}
              src={entity.iconUrl as string}
              fill
              style={{ objectFit: 'contain' }}
              alt={`${entity.id} icon`}
              data-qa="entity-icon"
            ></Image>
          </span>
        ) : (
          <span
            style={{
              width: size,
              height: size,
              backgroundImage:
                entity?.type === EntityType.Model
                  ? defaultModelIcon
                  : defaultAddonIcon,
            }}
            className={`inline-block shrink-0 bg-contain bg-no-repeat ${
              inverted ? 'invert' : ''
            } ${animate ? 'animate-bounce' : ''}`}
            role="img"
            aria-label={`${entityId} icon`}
          ></span>
        )}
      </>
    );
  },
);
ModelIconTemplate.displayName = 'ModelIconTemplate';

const defaultModelIcon = `var(--default-model, url(images/icons/message-square-lines-alt.svg))`;
const defaultAddonIcon = `var(--default-addon, url(images/icons/message-square-lines-alt.svg))`;

export const ModelIcon = ({
  entity,
  entityId,
  size,
  animate,
  inverted,
  isCustomTooltip,
}: Props) => {
  return (
    <Tooltip
      hideTooltip={isCustomTooltip}
      tooltip={entity?.name || entityId}
      triggerClassName="flex shrink-0 relative"
    >
      <ModelIconTemplate
        entity={entity}
        entityId={entityId}
        size={size}
        animate={animate}
        inverted={inverted}
      />
    </Tooltip>
  );
};
