import { IconFile } from '@tabler/icons-react';

import { BackendResourceTypeName } from '@/src/types/common';

import { PublicationItemRow } from './PublicationItemRow';
import { PublicationItemProps } from './view-props';

export const PublicationFileRow: React.FC<PublicationItemProps> = (props) => {
  return (
    <PublicationItemRow
      {...props}
      Icon={<IconFile size={18} className="text-secondary" />}
      itemTypeName={BackendResourceTypeName.FILE}
      dataQa="file"
    />
  );
};
