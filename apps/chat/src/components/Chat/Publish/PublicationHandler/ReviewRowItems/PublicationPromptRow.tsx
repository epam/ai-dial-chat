import { IconBulb } from '@tabler/icons-react';

import { PublicationItemRow } from './PublicationItemRow';

import { PromptInfo } from '@epam/ai-dial-shared';

interface Props {
  item: PromptInfo;
  level: number;
}

export const PublicationPromptRow: React.FC<Props> = ({ item, level }) => {
  return (
    <PublicationItemRow
      level={level}
      Icon={<IconBulb size={18} className="text-secondary" />}
      item={item}
      dataQa="prompt"
    />
  );
};
