import { IconBulb } from '@tabler/icons-react';

import { PublicationItemRow } from './PublicationItemRow';

import { PromptInfo } from '@epam/ai-dial-shared';

interface Props {
  prompt: PromptInfo;
  level: number;
  isEditable: boolean;
  editedName: string;
}

export const PublicationPromptRow: React.FC<Props> = ({
  prompt,
  level,
  isEditable,
  editedName,
}) => {
  return (
    <PublicationItemRow
      level={level}
      isEditable={isEditable}
      editedName={editedName}
      name={prompt.name}
      Icon={<IconBulb size={18} className="text-secondary" />}
      publicationInfo={prompt.publicationInfo}
    />
  );
};
