import Image from 'next/image';

import { ModelIconMappingType } from '@/types/icons';

interface Props {
  modelId: string;
  size: number;
  modelIconMapping: ModelIconMappingType;
  inverted?: boolean;
  animate?: boolean;
  modelName?: string;
}

export const ModelIcon = ({
  modelIconMapping,
  modelId,
  size,
  inverted,
  animate,
  modelName,
}: Props) => {
  return (
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
          title={modelName}
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
          title={modelName}
        ></span>
      )}
    </>
  );
};
