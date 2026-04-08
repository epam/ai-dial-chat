import { FC } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

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
        caption={t(MarketplaceI18nKeys.ImmediatelySendPrompt)}
        checked={value}
        onChange={() => onChange(true)}
        disabled={disabled}
        tooltip={tooltip}
      />
      <RadioButton
        caption={t(MarketplaceI18nKeys.PopulatePromptInTheChatInput)}
        checked={!value}
        onChange={() => onChange(false)}
        disabled={disabled}
        tooltip={tooltip}
      />
    </div>
  );
};
