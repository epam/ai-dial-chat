import { useTranslation } from '@/src/hooks/useTranslation';

import { isMacOs } from '@/src/utils/app/mobile';

import { EnterType } from '@/src/types/settings';
import { Translation } from '@/src/types/translation';

import { SettingsI18nKeys } from '@/src/constants/i18n';

import { withLabel } from '@/src/components/Common/Forms/Label';

import { DialRadioButton } from '@epam/ai-dial-ui-kit';

interface EnterTypeSelectProps {
  value: EnterType;
  onValueChange: (value: string) => void;
}

const view = withLabel(({ value, onValueChange }: EnterTypeSelectProps) => {
  const { t } = useTranslation(Translation.Settings);
  const enterLabel = t(SettingsI18nKeys.Enter);
  const shiftLabel = t(SettingsI18nKeys.Shift);
  const shiftEnterShortcutLabel = (
    <>
      {shiftLabel} + {enterLabel}
    </>
  );
  const ctrlEnterShortcutLabel = isMacOs() ? (
    <>⌘ + {enterLabel}</>
  ) : (
    <>
      {t(SettingsI18nKeys.Ctrl)} + {enterLabel}
    </>
  );

  return (
    <div className="mt-1 flex w-full flex-col gap-3">
      <DialRadioButton
        inputId={EnterType.Enter}
        name="enter-type-select"
        className="shrink-0 me-3"
        label={
          <>
            <b>{enterLabel}</b> - {t(SettingsI18nKeys.SendMessages)},{' '}
            <b>{shiftEnterShortcutLabel}</b> - {t(SettingsI18nKeys.NewLine)}
          </>
        }
        onChange={onValueChange}
        value={EnterType.Enter}
        checked={value === EnterType.Enter}
      />

      <DialRadioButton
        inputId={EnterType.CtrlEnter}
        name="enter-type-select"
        className="shrink-0 me-3"
        label={
          <>
            <b>{ctrlEnterShortcutLabel}</b> - {t(SettingsI18nKeys.SendMessages)},{' '}
            <b>{enterLabel}</b> - {t(SettingsI18nKeys.NewLine)}
          </>
        }
        onChange={onValueChange}
        value={EnterType.CtrlEnter}
        checked={value === EnterType.CtrlEnter}
      />
    </div>
  );
});

export const EnterTypeSelectLabeled = view;