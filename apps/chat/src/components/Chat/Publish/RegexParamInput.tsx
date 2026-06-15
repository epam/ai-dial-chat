import { ChangeEvent, RefObject, useCallback, useEffect } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

interface RegexParamInputProps {
  regEx: string;
  onRegExChange: (regExp: string) => void;
  onValidityChange?: (valid: boolean) => void;
  isInvalid?: boolean;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const isValidRegex = (pattern: string): boolean => {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  try {
    new RegExp(trimmed);
    return true;
  } catch {
    return false;
  }
};

export function RegexParamInput({
  regEx,
  onRegExChange,
  onValidityChange,
  isInvalid,
  className,
  inputRef,
}: RegexParamInputProps) {
  const { t } = useTranslation(Translation.Chat);

  const handleRegExChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onRegExChange(value);
      onValidityChange?.(isValidRegex(value));
    },
    [onRegExChange, onValidityChange],
  );

  useEffect(() => {
    onValidityChange?.(isValidRegex(regEx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={classNames(
        'relative flex w-full max-w-full flex-col bg-layer-3 md:max-w-[205px]',
        className,
      )}
    >
      <div className="flex h-[31px] w-full">
        <input
          ref={inputRef}
          className="w-full bg-transparent py-1 ps-2 text-xs outline-none placeholder:text-secondary"
          type="text"
          placeholder={t(ChatI18nKeys.EnterRegularExpression) || ''}
          value={regEx}
          onChange={handleRegExChange}
        />
      </div>
      {isInvalid && regEx.length > 0 && (
        <span className="px-2 pb-1 text-xxs text-error">
          {t(ChatI18nKeys.InvalidRegularExpression)}
        </span>
      )}
    </div>
  );
}
