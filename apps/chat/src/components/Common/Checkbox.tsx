import { IconCheck, IconMinus } from '@tabler/icons-react';
import { RefObject } from 'react';

import classNames from 'classnames';

interface CheckboxProps {
  className?: string | boolean;
  isSelected: boolean | undefined;
  isPartialSelected?: boolean;
  ref?: RefObject<HTMLInputElement>;
  onChange:
    | (() => void)
    | ((event: React.ChangeEvent<HTMLInputElement>) => void);
}
export function Checkbox({
  className,
  isSelected,
  isPartialSelected,
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
        checked={isSelected}
        onChange={onChange}
        ref={ref}
        data-qa={
          isSelected
            ? 'checked'
            : isPartialSelected
              ? 'partiallyChecked'
              : 'unchecked'
        }
      />
      {isSelected && (
        <IconCheck
          size={18}
          className="pointer-events-none absolute text-accent-primary "
        />
      )}

      {isPartialSelected && (
        <IconMinus
          size={18}
          className="pointer-events-none absolute text-accent-primary"
        />
      )}
    </>
  );
}
