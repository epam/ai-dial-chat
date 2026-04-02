import { FC } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { RadioButton } from '@/src/components/Common/Forms/RadioButton';

interface RadioGroupProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tooltip?: string;
}

export const StartersBehaviourRadioGroup: FC<RadioGroupProps> = ({
  value,
  onChange,
  disabled,
  tooltip,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <div className="relative flex flex-col gap-2">
      <RadioButton
        caption={t('Immediately send prompt')}
        checked={value}
        onChange={() => onChange(true)}
        disabled={disabled}
        tooltip={tooltip}
      />
      <RadioButton
        caption={t('Populate prompt in the chat input')}
        checked={!value}
        onChange={() => onChange(false)}
        disabled={disabled}
        tooltip={tooltip}
      />
    </div>
  );
};
