import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import Play from '@/public/images/icons/play.svg';
import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

export const StartReplayButton = () => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const handleReplayStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
      }),
    );
  }, [selectedConversationsIds, dispatch]);

  return (
    <DialButton
      className="button button-chat"
      onClick={handleReplayStart}
      data-qa="start-replay"
      data-replay-variables
      iconBefore={<Play height={18} width={18} />}
      label={t('Start replay')}
      variant={ButtonVariant.Secondary}
    />
  );
};
