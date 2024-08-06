import { IconRefreshDot } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

interface Props {
  isModelInMessages: boolean | undefined;
}

export const ReplayAsIsDescription = ({ isModelInMessages }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  return (
    <div className="flex max-h-full shrink flex-col overflow-auto">
      <div className="grow bg-layer-2 px-5 py-4" data-qa="replay-as-is">
        <div className="flex flex-col gap-3" data-qa="more-info">
          <span>{t('chat.common.more_info.label')}</span>
          <div className="flex items-center gap-2" data-qa="info-as-is">
            <span className="relative inline-block shrink-0 leading-none">
              <IconRefreshDot />
            </span>
            <span>{t('chat.common.button.replay_as_is.label')}</span>
          </div>

          <div className="flex flex-col justify-center">
            <span
              className="text-xs text-quaternary-bg-light"
              data-qa="replay-descr"
            >
              {t('chat.common.replicates_user_request_mode.text')}
            </span>
            {isModelInMessages && (
              <span
                className="mt-3 text-xxs leading-4 text-error"
                data-qa="replay-old-version"
              >
                {t('chat.common.replicates_user_request_mode.extra.text')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
