import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { useId } from 'react';

import classNames from 'classnames';

import { Tooltip } from '../Tooltip';
import { ToggleSwitchProps } from './view-props';

interface SwitchStateTextProps {
  switchText: string;
  isOn: boolean;
  disabled?: boolean;
}

const SwitchStateText = ({
  switchText,
  isOn,
  disabled,
}: SwitchStateTextProps) => (
  <span
    className={classNames(
      'h-4 min-w-0 shrink text-xs leading-4',
      isOn && 'px-1',
      isOn && !disabled ? 'text-controls-permanent' : 'text-primary',
      disabled && '!text-controls-accent-disable',
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
    'flex h-[22px] w-[56px] min-w-[56px] shrink-0 items-center justify-between overflow-hidden rounded-full px-[5px] py-1 transition-all duration-200',
    isOn ? 'flex-row bg-accent-primary' : 'flex-row-reverse bg-layer-4',
    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
    disabled && '!bg-controls-disable-accent',
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
            <SwitchStateText
              switchText={switchText}
              isOn={isOn}
              disabled={disabled}
            />
          )}
          <span
            className={classNames(
              'size-3 shrink-0 rounded-full',
              disabled ? 'bg-layer-4' : 'bg-controls-enable-primary',
            )}
          ></span>
        </label>
      </div>
      {additionalText && (
        <span
          className={classNames(disabled && 'text-controls-primary-disable')}
        >
          {additionalText}
        </span>
      )}
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
