import { IconCheck, IconMinus } from '@tabler/icons-react';
import { forwardRef } from 'react';

import classNames from 'classnames';

interface CheckboxProps {
  className?: string | boolean;
  checked: boolean | undefined;
  isPartialChecked?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, isPartialChecked, onChange }, ref) => {
    return (
      <>
        <input
          className={classNames(
            'checkbox peer size-[18px] bg-layer-3',
            className,
          )}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          ref={ref}
          data-qa={
            checked
              ? 'checked'
              : isPartialChecked
                ? 'partiallyChecked'
                : 'unchecked'
          }
        />
        {checked && (
          <IconCheck
            size={18}
            className="pointer-events-none absolute text-accent-primary "
          />
        )}

        {isPartialChecked && (
          <IconMinus
            size={18}
            className="pointer-events-none absolute text-accent-primary"
          />
        )}
      </>
    );
  },
);

Checkbox.displayName = 'Checkbox';
