import { ChangeEvent, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

interface RegexParamInputProps {
  regEx: string;
  onRegExChange: (regExp: string) => void;
  readonly?: boolean;
}

export function RegexParamInput({
  regEx,
  onRegExChange,
  readonly,
}: RegexParamInputProps) {
  const { t } = useTranslation(Translation.Chat);

  const handleRegExChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onRegExChange(e.target.value);
    },
    [onRegExChange],
  );

  return (
    <div className="relative flex h-[31px] w-full max-w-[205px] bg-layer-3">
      <input
        className="w-full bg-transparent py-1 pl-2 text-xs outline-none placeholder:text-secondary"
        type="text"
        placeholder={t('Enter regular expression...') || ''}
        value={regEx}
        disabled={readonly}
        onChange={handleRegExChange}
      />
    </div>
  );
}
