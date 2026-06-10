import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatI18nKeys } from '../../constants/translation-keys';

interface Props {
  /** Starter options to display as buttons. */
  starters: StarterOption[];
  /** Called with the full starter option when a button is clicked. */
  onSelect: (starter: StarterOption) => void;
}

const StarterButtons: FC<Props> = ({ starters, onSelect }) => {
  const { t } = useTranslation();

  if (starters.length === 0) return null;

  return (
    <div
      role="list"
      aria-label={t(ChatI18nKeys.ConversationStarters)}
      className="mt-4 flex flex-wrap justify-center gap-2"
    >
      {starters.map((starter, index) => (
        <div key={index} role="listitem">
          <DialRoundedButton
            label={starter.title}
            onClick={() => onSelect(starter)}
          />
        </div>
      ))}
    </div>
  );
};

export default memo(StarterButtons);
