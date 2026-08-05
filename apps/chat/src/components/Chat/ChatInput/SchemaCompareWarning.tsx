import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { ErrorMessage } from '@/src/components/Common/ErrorMessage';

export const SchemaCompareWarning = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex justify-center pb-3 md:pb-5">
      <div className="max-w-2xl">
        <ErrorMessage
          error={t(ChatI18nKeys.CompareModeUnavailable)}
          type="warning"
        />
      </div>
    </div>
  );
};
