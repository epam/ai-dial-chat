import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { useId } from 'react';

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
      'h-4 text-xs',
      isOn && 'px-1 text-controls-permanent',
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
  warning,
  disabled,
  handleSwitch,
}: ToggleSwitchProps) {
  const id = useId();
  const switchText = isOn ? switchOnText : switchOFFText;
  const switchClassName = classNames(
    'flex h-[22px] w-[50px] min-w-[50px] shrink-0 items-center justify-between rounded-full px-[5px] py-1 transition-all duration-200',
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
          id={id}
          className="sr-only h-0"
          checked={isOn}
        />
        <label htmlFor={id} className={switchClassName}>
          {switchText && (
            <SwitchStateText switchText={switchText} isOn={isOn} />
          )}
          <span className="size-3 rounded-full bg-controls-permanent"></span>
        </label>
      </div>
      {additionalText && <span>{additionalText}</span>}
      {warning && (
        <Tooltip
          tooltip={warning}
          triggerClassName="flex shrink-0 text-warning"
          contentClassName="z-[2000]"
        >
          <IconAlertTriangleFilled size={20} />
        </Tooltip>
      )}
    </Tooltip>
  );
}
