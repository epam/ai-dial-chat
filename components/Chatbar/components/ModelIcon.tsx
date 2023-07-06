import { IconMessage } from '@tabler/icons-react';

import Image from 'next/image';

import { ModelIconMappingType } from '@/types/icons';

interface Props {
  modelId: string;
  size: number;
  modelIconMapping: ModelIconMappingType;
  inverted?: boolean;
  animate?: boolean;
}

export const ModelIcon = ({
  modelIconMapping,
  modelId,
  size,
  inverted,
  animate,
}: Props) => {
  return (
    <>
      {modelIconMapping[modelId] ? (
        <Image
          className={`text-red-100 ${inverted ? 'invert' : ''} ${
            animate ? 'animate-bounce' : ''
          }`}
          src={`/images/${modelIconMapping[modelId]}`}
          width={size}
          height={size}
          alt={`${modelId} icon`}
          style={{ color: 'red' }}
        ></Image>
      ) : (
        <IconMessage size={size} />
      )}
    </>
  );
};
