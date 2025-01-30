import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ErrorMessage } from '@/src/components/Common/ErrorMessage';

export const SchemaCompareWarning = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex justify-center">
      <div className="max-w-2xl">
        <ErrorMessage
          error={t(
            'Compare Mode is unavailable with agents requiring a configuration. Please either select a single chat or switch to agents without configuration schema to continue.',
          )}
          type="warning"
        />
      </div>
    </div>
  );
};
