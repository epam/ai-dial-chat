import { ToggleSwitch, ToggleSwitchProps } from './ToggleSwitch';

interface ToggleSwitchLabeledProps extends ToggleSwitchProps {
  labelText?: string | null;
  labelClassName?: string;
}

export function ToggleSwitchLabeled({
  isOn,
  labelText,
  switchOnText,
  switchOFFText,
  labelClassName,
  handleSwitch,
}: ToggleSwitchLabeledProps) {
  return (
    <div
      className="flex w-full items-center gap-5"
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
