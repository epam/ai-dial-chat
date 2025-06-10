import { IconPencilMinus } from '@tabler/icons-react';

import { IconButton } from '@/src/components/Common/IconButton';
import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

import { PublicationControls } from './PublicationControls';

import { ConversationInfo } from '@epam/ai-dial-shared';

interface Props {
  entity: ConversationInfo;
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onToggleInput: () => void;
}

export const ChatPublicationControls = ({
  entity,
  showScrollDownButton,
  onScrollDownClick,
  onToggleInput,
}: Props) => {
  return (
    <PublicationControls
      controlsClassNames="mx-2 mb-2 mt-5 flex-row md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl"
      entity={entity}
    >
      <IconButton
        Icon={IconPencilMinus}
        name="Edit"
        dataQa="edit-chat"
        onClick={onToggleInput}
      />
      {showScrollDownButton && (
        <ScrollDownButton
          className="-top-16 right-0 md:-top-20"
          onScrollDownClick={onScrollDownClick}
        />
      )}
    </PublicationControls>
  );
};
