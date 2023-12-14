import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface ToggleFullWidthProps {
  isOn: boolean;
  handleSwitch: () => void;
}

interface SwitchStateTextProps {
  switchText: string;
}

const SwitchStateText = ({ switchText }: SwitchStateTextProps) => (
  <span className="h-[15px] w-6 text-xs">{switchText}</span>
);

export const ToggleFullWidth = ({
  isOn,
  handleSwitch,
}: ToggleFullWidthProps) => {
  const { t } = useTranslation(Translation.Settings);

  const switchBackground = isOn
    ? 'bg-blue-500 dark:bg-blue-500'
    : 'bg-gray-400 dark:bg-gray-600';

  return (
    <label htmlFor="toggle" className="flex w-full items-center gap-5">
      <span className="w-[120px]">{t('Full width chat')}</span>
      <input
        type="checkbox"
        onChange={handleSwitch}
        id="toggle"
        className="sr-only"
        checked={isOn}
      />

      <div
        className={classNames(
          'flex h-[22px] w-[50px] shrink-0 cursor-pointer items-center  gap-1 rounded-2xl p-1.5 transition-all duration-200',
          switchBackground,
        )}
      >
        {isOn && <SwitchStateText switchText={t('ON')} />}
        <span className="h-3 w-3 rounded-full bg-gray-100"></span>
        {!isOn && <SwitchStateText switchText={t('OFF')} />}
      </div>
    </label>
  );
};
