import Image from 'next/image';

import { ModelIconMappingType } from '@/types/icons';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/Common/Tooltip';

interface Props {
  modelId: string;
  size: number;
  modelIconMapping: ModelIconMappingType;
  inverted?: boolean;
  animate?: boolean;
  modelName?: string;
  isCustomTooltip?: boolean;
}

export const ModelIcon = ({
  modelIconMapping,
  modelId,
  size,
  animate,
  modelName,
  inverted,
  isCustomTooltip,
}: Props) => {
  const template = (
    <>
      {modelIconMapping[modelId] ? (
        <Image
          className={`${inverted ? 'invert' : ''} ${
            animate ? 'animate-bounce' : ''
          }`}
          src={`/images/${modelIconMapping[modelId]}`}
          width={size}
          height={size}
          alt={`${modelId} icon`}
        ></Image>
      ) : (
        <span
          style={{
            width: size,
            height: size,
            backgroundImage: `var(--default-model, url(/images/icons/message-square-lines-alt.svg))`,
          }}
          className={`block bg-contain bg-no-repeat ${
            inverted ? 'invert' : ''
          } ${animate ? 'animate-bounce' : ''}`}
          role="img"
          aria-label={`${modelId} icon`}
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
          <TooltipTrigger>{template}</TooltipTrigger>
          <TooltipContent>{modelName}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
};
