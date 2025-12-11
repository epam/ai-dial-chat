import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { withLabel } from '@/src/components/Common/Forms/Label';
import { RadioButton } from '@/src/components/Common/Forms/RadioButton';

export enum EnterType {
  Enter = 'Enter',
  CtrlEnter = 'CtrlEnter',
}

interface EnterTypeSelectProps {
  value: EnterType;
  onValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EnterTypeSelect = ({
  value,
  onValueChange,
}: EnterTypeSelectProps) => {
  const { t } = useTranslation(Translation.Settings);
  return (
    <div className="flex flex-col gap-3">
      <RadioButton
        id={EnterType.Enter}
        name="enter-type-select"
        caption={
          <>
            <b>{t('Enter')}</b> - {t('send message')},{' '}
            <b>{t('Shift + Enter')}</b> - {t('new line')}
          </>
        }
        onChange={onValueChange}
        value={'Enter'}
        checked={value === EnterType.Enter}
      />

      <RadioButton
        id={EnterType.CtrlEnter}
        name="enter-type-select"
        caption={
          <>
            <b>{t('Ctrl + Enter')}</b> - {t('send message')},{' '}
            <b>{t('Enter')}</b> - {t('new line')}
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
