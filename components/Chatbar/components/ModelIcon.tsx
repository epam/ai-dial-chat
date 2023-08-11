import Image from 'next/image';

import { OpenAIEntity } from '@/types/openai';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/Common/Tooltip';

interface Props {
  entityId: string;
  entity: OpenAIEntity | undefined;
  size: number;
  inverted?: boolean;
  animate?: boolean;
  isCustomTooltip?: boolean;
}

export const ModelIcon = ({
  entity,
  entityId,
  size,
  animate,
  inverted,
  isCustomTooltip,
}: Props) => {
  const template = (
    <>
      {entity?.iconUrl != null ? (
        <span
          className={`relative inline-block shrink-0 leading-none ${
            animate ? 'animate-bounce' : ''
          }`}
          style={{ height: `${size}px`, width: `${size}px` }}
        >
          <Image
            className={`${inverted ? 'invert' : ''} `}
            src={entity.iconUrl as string}
            fill
            style={{ objectFit: 'contain' }}
            alt={`${entity.id} icon`}
          ></Image>
        </span>
      ) : (
        <span
          style={{
            width: size,
            height: size,
            backgroundImage: `var(--default-model, url(/images/icons/message-square-lines-alt.svg))`,
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

  return (
    <>
      {isCustomTooltip ? (
        template
      ) : (
        <Tooltip>
          <TooltipTrigger className="flex shrink-0">{template}</TooltipTrigger>
          <TooltipContent>{entity?.name || entityId}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
};
