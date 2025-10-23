import { useTranslation } from 'next-i18next';

import { ReplaceOptions } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { Select, SelectOption } from '../Select';

interface ReplaceSelectorProps {
  selectedOption: ReplaceOptions;
  onOptionChangeHandler: (optionId: string) => void;
}

export const ReplaceSelector = ({
  selectedOption,
  onOptionChangeHandler,
}: ReplaceSelectorProps) => {
  const { t } = useTranslation(Translation.Chat);

  const replaceSelectorOptions: SelectOption[] = [
    ReplaceOptions.Postfix,
    ReplaceOptions.Replace,
    ReplaceOptions.Ignore,
  ].map((option) => ({
    id: option,
    displayName: t(option),
  }));

  return (
    <Select
      options={replaceSelectorOptions}
      selectedOptionName={t(selectedOption)}
      onOptionChangeHandler={onOptionChangeHandler}
      optionClassName="pl-5"
    />
  );
};
