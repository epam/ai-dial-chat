import { FC } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import Play from '../../../public/images/icons/play.svg';
import RefreshCW from '../../../public/images/icons/refresh-cw.svg';

interface ChatReplayControlsProps {
  onClickReplayReStart: () => void;
  onClickReplayStart: () => void;
  showReplayStart: boolean;
}
const ChatReplayControls: FC<ChatReplayControlsProps> = ({
  onClickReplayReStart,
  onClickReplayStart,
  showReplayStart,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const isError = useAppSelector(
    ConversationsSelectors.selectIsErrorReplayConversations,
  );
  return (
    <>
      {showReplayStart ? (
        <button
          className="border-gray-400 bg-gray-200 hover:bg-gray-400 absolute inset-x-0 -top-14 mx-auto mb-3 flex w-fit items-center gap-3 rounded border p-3"
          onClick={onClickReplayStart}
          data-qa="start-replay"
        >
          <Play height={18} width={18} className="shrink-0 text-secondary" />
          <span>{t('Start replay')}</span>
        </button>
      ) : (
        <button
          className="border-gray-400 bg-gray-200 hover:bg-gray-400 absolute inset-x-0 -top-14 mx-auto mb-3 flex w-fit items-center gap-3 rounded border p-3"
          onClick={onClickReplayReStart}
          data-qa="proceed-reply"
        >
          <RefreshCW
            height={18}
            width={18}
            className="shrink-0 text-secondary"
          />

          {isError ? (
            <span>
              {t(
                'Looks like something went wrong. Do you want to continue replay?',
              )}
            </span>
          ) : (
            <span>{t('Continue replay')}</span>
          )}
        </button>
      )}
    </>
  );
};

export default ChatReplayControls;
