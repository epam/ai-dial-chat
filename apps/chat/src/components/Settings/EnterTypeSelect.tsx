import { useTranslation } from '@/src/hooks/useTranslation';

import { isMacOs } from '@/src/utils/app/mobile';

import { EnterType } from '@/src/types/settings';
import { Translation } from '@/src/types/translation';

import { withLabel } from '@/src/components/Common/Forms/Label';

import { DialRadioButton } from '@epam/ai-dial-ui-kit';

interface EnterTypeSelectProps {
  value: EnterType;
  onValueChange: (value: string) => void;
}

export const EnterTypeSelect = ({
  value,
  onValueChange,
}: EnterTypeSelectProps) => {
  const { t } = useTranslation(Translation.Settings);
  return (
    <div className="mt-1 flex flex-col gap-3">
      <DialRadioButton
        inputId={EnterType.Enter}
        name="enter-type-select"
        label={
          <>
            <b>{t('Enter')}</b> - {t('send message')},{' '}
            <b>{t('Shift + Enter')}</b> - {t('new line')}
          </>
        }
        onChange={onValueChange}
        value={EnterType.Enter}
        checked={value === EnterType.Enter}
      />

      <DialRadioButton
        inputId={EnterType.CtrlEnter}
        name="enter-type-select"
        label={
          <>
            <b>{t(`${isMacOs ? '⌘' : 'Ctrl'} + Enter`)}</b> -{' '}
            {t('send message')}, <b>{t('Enter')}</b> - {t('new line')}
          </>
        }
        onChange={onValueChange}
        value={EnterType.CtrlEnter}
        checked={value === EnterType.CtrlEnter}
      />
    </div>
  );
};

export const EnterTypeSelectLabeled = withLabel(EnterTypeSelect);
