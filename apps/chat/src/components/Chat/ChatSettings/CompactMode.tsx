import { IconHelp } from '@tabler/icons-react';
import { FC, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { DisableOverlay } from '@/src/components/Common/DisableOverlay';
import { ToggleSwitchLabeled } from '@/src/components/Common/ToggleSwitch/ToggleSwitchLabeled';
import { Tooltip } from '@/src/components/Common/Tooltip';

interface CompactModeProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export const CompactMode: FC<CompactModeProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const handleSwitch = useCallback(() => {
    onChange(!value);
  }, [onChange, value]);

  return (
    <div className="relative flex flex-col" data-qa="compact-mode-container">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-start">{t(ChatI18nKeys.CompactMode)}</label>
        <Tooltip
          triggerClassName="text-secondary"
          tooltip={t(ChatI18nKeys.CompactModeHint)}
        >
          <IconHelp size={18} />
        </Tooltip>
      </div>
      {disabled && <DisableOverlay />}

      <ToggleSwitchLabeled
        isOn={value}
        labelText={t(ChatI18nKeys.ReduceSpacingWithinMessages)}
        labelClassName="grow"
        handleSwitch={handleSwitch}
        switchOnText={t(ChatI18nKeys.ON)}
        switchOFFText={t(ChatI18nKeys.OFF)}
        isLabelOnRight
      />
    </div>
  );
};
