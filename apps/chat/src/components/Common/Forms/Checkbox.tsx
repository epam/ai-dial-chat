import { IconCheck, IconMinus } from '@tabler/icons-react';
import { InputHTMLAttributes, forwardRef } from 'react';

import classNames from 'classnames';

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  caption?: string;
  className?: string;
  isPartiallyChecked?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, isPartiallyChecked, caption, checked, ...props }, ref) => (
    <div className="flex items-center gap-2">
      <div className="relative size-[18px]">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={props.onChange}
          data-qa={
            checked
              ? 'checked'
              : isPartiallyChecked
                ? 'partiallyChecked'
                : 'unchecked'
          }
          className={classNames(
            className,
            'peer relative m-0 mr-2 inline size-[18px] shrink-0 appearance-none rounded-sm border  border-primary bg-layer-3 focus-visible:outline-none',
            {
              'indeterminate::border-primary checked:border-primary':
                props.disabled,
              'checked:border-accent-primary indeterminate:border-accent-primary hover:border-accent-primary':
                !props.disabled,
            },
          )}
        />

        {checked && !isPartiallyChecked && (
          <IconCheck
            size={18}
            className={classNames(
              'pointer-events-none absolute left-0 top-0',
              props.disabled ? 'stroke-primary' : 'text-accent-primary',
            )}
          />
        )}

        {isPartiallyChecked && (
          <IconMinus
            size={18}
            className={classNames(
              'pointer-events-none absolute left-0 top-0',
              props.disabled ? 'stroke-primary' : 'text-accent-primary',
            )}
          />
        )}
      </div>

      {caption && <span className="text-primary">{caption}</span>}
    </div>
  ),
);

Checkbox.displayName = 'Checkbox';
