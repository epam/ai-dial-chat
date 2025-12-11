import { IconCircle } from '@tabler/icons-react';
import React, { InputHTMLAttributes, useId } from 'react';

import classNames from 'classnames';

import { Tooltip } from '../Tooltip';

import IconCircleChecked from '@/public/images/icons/radio-checked.svg';

interface RadioButtonProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  caption?: string | React.ReactNode;
  className?: string;
  tooltip?: string;
}

export const RadioButton = ({
  caption,
  checked,
  className,
  tooltip,
  ...rest
}: RadioButtonProps) => {
  const generatedId = useId();
  const id = rest.id ?? generatedId;

  return (
    <Tooltip tooltip={tooltip} triggerClassName="w-fit">
      <label
        id="auth-login-option"
        htmlFor={id}
        className={classNames(
          'group flex select-none items-center justify-start gap-2',
          {
            'cursor-pointer': !checked && !rest.disabled,
          },
          className,
        )}
      >
        <input
          id={id}
          type="radio"
          {...rest}
          checked={checked}
          className="peer sr-only"
        />

        <span className="hidden peer-checked:block">
          <IconCircleChecked
            width={17}
            height={17}
            className="text-accent-primary"
          />
        </span>
        <span className="block peer-checked:hidden">
          <IconCircle size={18} className="text-secondary" strokeWidth={1} />
        </span>

        {!!caption && (
          <span
            className={classNames(
              'text-sm',
              rest.disabled ? 'text-secondary' : 'text-primary',
            )}
          >
            {caption}
          </span>
        )}
      </label>
    </Tooltip>
  );
};
