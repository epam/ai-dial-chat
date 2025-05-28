import { IconBulb } from '@tabler/icons-react';

import { PublicationItemRow } from './PublicationItemRow';

import { PromptInfo } from '@epam/ai-dial-shared';

interface Props {
  prompt: PromptInfo;
  level: number;
}

export const PublicationPromptRow: React.FC<Props> = ({ prompt, level }) => {
  return (
    <PublicationItemRow
      level={level}
      name={prompt.name}
      Icon={<IconBulb size={18} className="text-secondary" />}
      publicationInfo={prompt.publicationInfo}
      dataQa="prompt"
      editedName={prompt.name}
      isEditMode={false}
    />
  );
};
