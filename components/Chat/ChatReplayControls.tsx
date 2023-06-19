import { IconPlayerPlay } from '@tabler/icons-react';
import { FC, MouseEventHandler, useTransition } from 'react';
import { useTranslation } from 'react-i18next';

interface ChatReplayControlsProps {
  onClickReplayReStart: MouseEventHandler<HTMLButtonElement>;
  onClickReplayStart: MouseEventHandler<HTMLButtonElement>;
  showReplayStart: boolean;
}
const ChatReplayControls: FC<ChatReplayControlsProps> = ({
  onClickReplayReStart,
  onClickReplayStart,
  showReplayStart,
}) => {
  const { t } = useTranslation('chat');
  return (
    <div
      className={`absolute w-full 
      ${showReplayStart ? 'bottom-20' : 'bottom-0'} 
      border-transparent bg-gradient-to-b from-transparent via-white to-white pb-8 dark:border-white/20 dark:via-[#343541] dark:to-[#343541] md:pb-6`}
    >
      {showReplayStart ? (
        <button
          className={`mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4
           text-black opacity-50 hover:opacity-100 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2`}
          onClick={onClickReplayStart}
        >
          <span>{t('Start replay')}</span>
          <IconPlayerPlay size={30} />
        </button>
      ) : (
        <button
          className={`mx-auto flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 
          text-black opacity-50 hover:opacity-100 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2`}
          onClick={onClickReplayReStart}
        >
          <span>
            {t(
              'Looks like something went wrong. Do you want to restart replay?',
            )}
          </span>
          <IconPlayerPlay size={30} />
        </button>
      )}
    </div>
  );
};

export default ChatReplayControls;
