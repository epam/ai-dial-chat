import { ChangeEvent, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface RegexParamInputProps {
  regEx: string;
  onRegExChange: (regExp: string) => void;
  className?: string;
}

export function RegexParamInput({
  regEx,
  onRegExChange,
  className,
}: RegexParamInputProps) {
  const { t } = useTranslation(Translation.Chat);

  const handleRegExChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onRegExChange(e.target.value);
    },
    [onRegExChange],
  );

  return (
    <div className="flex w-full flex-wrap rounded-primary  border border-secondary bg-layer-2 p-1 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary">
      <input
        className="w-full bg-transparent py-1 pl-2 outline-none"
        type="text"
        placeholder={t('Enter regular expression...') || ''}
        value={regEx}
        onChange={handleRegExChange}
      />
    </div>
  );
}
