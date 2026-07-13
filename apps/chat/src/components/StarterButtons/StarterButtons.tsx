import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { StarterButtons as StarterButtonsLib } from '@epam/ai-dial-starter-buttons';
import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';

interface Props {
  starters: StarterOption[];
  onSelect: (starter: StarterOption) => void;
}

const StarterButtons: FC<Props> = ({ starters, onSelect }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <StarterButtonsLib
      starters={starters}
      onSelect={onSelect}
      isMobile={isMobile}
      labels={{
        list: t(ChatI18nKeys.ConversationStarters),
        overflow: t(ChatI18nKeys.StarterButtonsOverflow),
      }}
    />
  );
};

export default memo(StarterButtons);
