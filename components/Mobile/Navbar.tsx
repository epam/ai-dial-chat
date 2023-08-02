import { IconPlus } from '@tabler/icons-react';
import { FC } from 'react';

interface Props {
  selectedConversationNames: string[];
  onNewConversation: () => void;
}

export const Navbar: FC<Props> = ({
  selectedConversationNames,
  onNewConversation,
}) => {
  return (
    <nav className="flex w-full justify-between bg-[#202123] px-4 py-3">
      <div className="mr-4"></div>

      <div className="max-w-[240px] truncate">
        {selectedConversationNames.join(' / ')}
      </div>

      <IconPlus
        className="mr-8 cursor-pointer hover:text-neutral-400"
        onClick={onNewConversation}
      />
    </nav>
  );
};
