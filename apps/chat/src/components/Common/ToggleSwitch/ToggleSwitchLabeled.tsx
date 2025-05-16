import classNames from 'classnames';

import { ToggleSwitch } from './ToggleSwitch';
import { ToggleSwitchProps } from './view-props';

interface ToggleSwitchLabeledProps extends ToggleSwitchProps {
  labelText?: string | null;
  labelClassName?: string;
  isLabelOnRight?: boolean;
}

export function ToggleSwitchLabeled({
  isOn,
  labelText,
  switchOnText,
  switchOFFText,
  labelClassName,
  isLabelOnRight,
  handleSwitch,
}: ToggleSwitchLabeledProps) {
  return (
    <div
      className={classNames(
        'flex w-full items-center',
        isLabelOnRight ? 'flex-row-reverse justify-center gap-2' : 'gap-5',
      )}
      data-qa="toggle-switch-labeled"
    >
      {labelText && <span className={labelClassName ?? ''}>{labelText}</span>}

      <ToggleSwitch
        isOn={isOn}
        handleSwitch={handleSwitch}
        switchOnText={switchOnText}
        switchOFFText={switchOFFText}
      />
    </div>
  );
}
