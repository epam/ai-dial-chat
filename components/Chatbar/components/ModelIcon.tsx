import { IconMessage } from '@tabler/icons-react';

import Image from 'next/image';

interface Props {
  modelId: string;
  size: number;
  modelIconMapping: Record<string, string>;
}

export const ModelIcon = ({ modelIconMapping, modelId, size }: Props) => {
  return (
    <>
      {modelIconMapping[modelId] ? (
        <Image
          className="text-red-100 invert"
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
