import classNames from 'classnames';

import { Tooltip } from '../Tooltip';
import { ToggleSwitchProps } from './view-props';

interface SwitchStateTextProps {
  switchText: string;
  isOn: boolean;
}

const SwitchStateText = ({ switchText, isOn }: SwitchStateTextProps) => (
  <span
    className={classNames(
      'h-[15px] w-6 text-xs',
      isOn && 'text-controls-permanent',
    )}
  >
    {switchText}
  </span>
);

export function ToggleSwitch({
  isOn,
  switchOnText,
  switchOFFText,
  additionalText,
  className,
  tooltip,
  disabled,
  handleSwitch,
}: ToggleSwitchProps) {
  const switchText = isOn ? switchOnText : switchOFFText;
  const switchClassName = classNames(
    'flex min-w-[50px] shrink-0 items-center gap-1 rounded-full p-1.5 transition-all duration-200',
    isOn ? 'flex-row bg-accent-primary' : 'flex-row-reverse bg-layer-4',
    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
  );

  return (
    <Tooltip triggerClassName={className} tooltip={tooltip}>
      <div data-qa="toggle-switch">
        <input
          type="checkbox"
          disabled={disabled}
          onChange={handleSwitch}
          id="toggle"
          className="sr-only"
          checked={isOn}
        />
        <label htmlFor="toggle" className={switchClassName}>
          {switchText && (
            <SwitchStateText switchText={switchText} isOn={isOn} />
          )}
          <span className="size-3 rounded-full bg-controls-permanent"></span>
        </label>
      </div>
      {additionalText && <span>{additionalText}</span>}
    </Tooltip>
  );
}
