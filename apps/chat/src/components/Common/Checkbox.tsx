import { IconCheck, IconMinus } from '@tabler/icons-react';
import { RefObject } from 'react';

import classNames from 'classnames';

interface CheckboxProps {
  className?: string | boolean;
  checked: boolean | undefined;
  isPartialChecked?: boolean;
  ref?: RefObject<HTMLInputElement>;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
export function Checkbox({
  className,
  checked,
  isPartialChecked,
  ref,
  onChange,
}: CheckboxProps) {
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
}
