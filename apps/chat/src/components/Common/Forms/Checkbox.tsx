import { IconCheck } from '@tabler/icons-react';
import { InputHTMLAttributes, forwardRef } from 'react';

import classNames from 'classnames';

import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import Tooltip from '@/src/components/Common/Tooltip';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  tooltip?: string;
  caption?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ tooltip, caption, className, ...rest }, ref) => (
    <Tooltip tooltip={tooltip}>
      <label className="relative flex size-[18px] w-full shrink-0 cursor-pointer items-center">
        <input
          ref={ref}
          type="checkbox"
          className={classNames(
            'checkbox peer mr-0 size-[18px] bg-layer-3',
            className,
          )}
          {...rest}
        />
        <IconCheck
          size={18}
          className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
        />
        {caption && (
          <span className="ml-2 whitespace-nowrap text-sm">{caption}</span>
        )}
      </label>
    </Tooltip>
  ),
);

Checkbox.displayName = 'Checkbox';

export const CheckboxField = withErrorMessage(withLabel(Checkbox));
