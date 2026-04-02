import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import Rotate from '@/public/images/icons/rotate.svg';

export const ChatCompareRotate = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex grow flex-col items-center justify-center gap-4">
      <div className="text-accent-primary">
        <Rotate width={60} height={60} />
      </div>
      <div className="text-base">
        {t(ChatI18nKeys.PleaseRotateScreenToUseCompareMode)}
      </div>
    </div>
  );
};
