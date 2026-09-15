import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { StarterButtons as StarterButtonsLib } from '@epam/ai-dial-starter-buttons';
import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useUiFeature } from '../../hooks/useUiFeature';

interface Props {
  starters: StarterOption[];
  onSelect: (starter: StarterOption) => void;
}

const StarterButtons: FC<Props> = ({ starters, onSelect }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isEveryStarterShown = useUiFeature(OverlayFeature.ShowAllStarters);

  return (
    <StarterButtonsLib
      starters={starters}
      onSelect={onSelect}
      isMobile={isMobile}
      isCollapsible={!isEveryStarterShown}
      labels={{
        list: t(ChatI18nKeys.ConversationStarters),
        overflow: t(ChatI18nKeys.StarterButtonsOverflow),
      }}
    />
  );
};

export default memo(StarterButtons);
