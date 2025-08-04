import { IconFile } from '@tabler/icons-react';

import { BackendResourceTypeName } from '@/src/types/common';
import { DialFile } from '@/src/types/files';

import { PublicationItemRow } from './PublicationItemRow';

interface Props {
  item: DialFile;
  level: number;
}

export const PublicationFileRow: React.FC<Props> = ({ item, level }) => {
  return (
    <PublicationItemRow
      level={level}
      Icon={<IconFile size={18} className="text-secondary" />}
      item={item}
      itemTypeName={BackendResourceTypeName.FILE}
      dataQa="file"
    />
  );
};
