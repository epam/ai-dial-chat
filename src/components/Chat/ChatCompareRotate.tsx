import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import Rotate from '../../../public/images/icons/rotate.svg';

export const ChatCompareRotate = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex grow flex-col items-center justify-center gap-4">
      <div className="text-blue-500">
        <Rotate width={60} height={60} />
      </div>
      <div className="text-base">
        {t('Please rotate the screen to use compare mode')}
      </div>
    </div>
  );
};
