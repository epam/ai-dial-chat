import { IconCheck, IconMinus } from '@tabler/icons-react';
import React, { forwardRef } from 'react';

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
      <span className="relative inline-flex size-[18px] shrink-0">
        <input
          className={classNames(
            'checkbox peer size-[18px] bg-layer-3',
            isPartialChecked && 'border-accent-primary',
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
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <IconCheck size={14} className="text-accent-primary" />
          </span>
        )}

        {isPartialChecked && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <IconMinus size={14} className="text-accent-primary" />
          </span>
        )}
      </span>
    );
  },
);

Checkbox.displayName = 'Checkbox';
