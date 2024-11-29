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
        <div className="flex flex-col gap-3" data-qa="agent-info-container">
          <span>{t('More info')}</span>
          <div className="flex items-center gap-2" data-qa="info-as-is">
            <span className="relative inline-block shrink-0 leading-none">
              <IconRefreshDot />
            </span>
            <span>{t('Replay as is')}</span>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-xs text-secondary" data-qa="replay-descr">
              {t(
                'This mode replicates user requests from the original conversation including settings set in each message.',
              )}
            </span>
            {isModelInMessages && (
              <span
                className="mt-3 text-xxs leading-4 text-error"
                data-qa="replay-old-version"
              >
                {t(
                  'Please note that some of your messages were created in older DIAL version. "Replay as is" could be working not as expected.',
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
