import { IconCircle } from '@tabler/icons-react';
import { InputHTMLAttributes, useId } from 'react';

import classNames from 'classnames';

import IconCircleChecked from '@/public/images/icons/radio-checked.svg';

interface RadioButtonProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  caption?: string;
  className?: string;
}

export const RadioButton = ({
  caption,
  checked,
  className,
  ...rest
}: RadioButtonProps) => {
  const generatedId = useId();
  const id = rest.id ?? generatedId;

  return (
    <label
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

      {!!caption && <span className="text-sm text-primary">{caption}</span>}
    </label>
  );
};
