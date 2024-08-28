import { IconCircleX } from '@tabler/icons-react';
import { FC } from 'react';

import { useTranslation } from 'next-i18next';

import { ErrorMessage } from '@/src/types/error';
import { Translation } from '@/src/types/translation';

interface Props {
  error: ErrorMessage;
}

export const ErrorMessageDiv: FC<Props> = ({ error }) => {
  const { t } = useTranslation(Translation.Common);
  return (
    <div className="mx-6 flex h-full flex-col items-center justify-center text-error">
      <div className="mb-5">
        <IconCircleX size={36} />
      </div>
      <div className="mb-3 text-2xl font-medium">{error.title}</div>
      {error.messageLines.map((line, index) => (
        <div key={index} className="text-center">
          {' '}
          {line}{' '}
        </div>
      ))}
      <div className="mt-4 text-xs opacity-50">
        {error.code ? (
          <i>
            {t('common.label.code')} {error.code}
          </i>
        ) : (
          ''
        )}
      </div>
    </div>
  );
};
