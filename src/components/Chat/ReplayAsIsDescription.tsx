import { IconRefreshDot } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

interface Props {
  isModelInMessages: boolean | undefined;
}

export const ReplayAsIsDescription = ({ isModelInMessages }: Props) => {
  const { t } = useTranslation('chat');
  return (
    <div className="entity-settings-container">
      <div className="grow bg-gray-200 px-5 py-4 dark:bg-gray-800">
        <div className="flex flex-col gap-3" data-qa="more-info">
          <span>{t('More info')}</span>
          <div className="flex items-center gap-2" data-qa="info-as-is">
            <span className="relative inline-block shrink-0 leading-none">
              <IconRefreshDot />
            </span>
            <span>{t('Replay as is')}</span>
          </div>

          <div className="flex flex-col justify-center p-3">
            <span className="text-xs text-gray-500" data-qa="app-descr">
              {t(
                'This mode replicates user requests from the original conversation including settings set in each message.',
              )}
            </span>
            {isModelInMessages && (
              <span className="mt-3 text-xxs leading-4 text-red-800 dark:text-red-400">
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
