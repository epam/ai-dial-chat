import { ChangeEvent, RefObject, useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

interface RegexParamInputProps {
  regEx: string;
  onRegExChange: (regExp: string) => void;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function RegexParamInput({
  regEx,
  onRegExChange,
  className,
  inputRef,
}: RegexParamInputProps) {
  const { t } = useTranslation(Translation.Chat);

  const handleRegExChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onRegExChange(e.target.value);
    },
    [onRegExChange],
  );

  return (
    <div
      className={classNames(
        'relative flex h-[31px] w-full max-w-full bg-layer-3 md:max-w-[205px]',
        className,
      )}
    >
      <input
        ref={inputRef}
        className="w-full bg-transparent py-1 pl-2 text-xs outline-none placeholder:text-secondary"
        type="text"
        placeholder={t(ChatI18nKeys.EnterRegularExpression) || ''}
        value={regEx}
        onChange={handleRegExChange}
      />
    </div>
  );
}
