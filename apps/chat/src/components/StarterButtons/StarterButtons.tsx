import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';

interface Props {
  /** Starter options to display as buttons. */
  starters: StarterOption[];
  /** Called with the populate text when a button is clicked. */
  onSelect: (text: string) => void;
}

const StarterButtons: FC<Props> = ({ starters, onSelect }) => {
  if (starters.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Conversation starters"
      className="mt-4 flex flex-wrap justify-center gap-2"
    >
      {starters.map((starter) => (
        <div key={starter.const} role="listitem">
          <DialRoundedButton
            label={starter.title}
            onClick={() => onSelect(starter['dial:widgetOptions'].populateText)}
          />
        </div>
      ))}
    </div>
  );
};

export default StarterButtons;
