import { IconBulb } from '@tabler/icons-react';

import { BackendResourceTypeName } from '@/src/types/common';

import { PublicationItemRow } from './PublicationItemRow';
import { PublicationItemProps } from './view-props';

export const PublicationPromptRow: React.FC<PublicationItemProps> = (props) => {
  return (
    <PublicationItemRow
      {...props}
      Icon={<IconBulb size={18} className="text-secondary" />}
      itemTypeName={BackendResourceTypeName.PROMPT}
      dataQa="prompt"
    />
  );
};
