import { ChangeEvent, useCallback } from 'react';

import classNames from 'classnames';

import { replaceSpacesFromString } from '@/src/utils/app/common';

import { ErrorTooltip } from './ErrorTooltip';
import { Tooltip } from './Tooltip';

interface Props {
  value: string;
  isEditMode: boolean;
  className?: string;
  inputClassName?: string;
  tooltipIconClassName?: string;
  placeholder?: string;
  errors?: string[];
  onChange: (value: string) => void;
}

export const EditableField: React.FC<Props> = ({
  value,
  isEditMode,
  className,
  inputClassName,
  tooltipIconClassName,
  placeholder,
  errors,
  onChange,
}) => {
  const isErrors = !!errors?.length;
  const onChangeHandler = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const cleanName = replaceSpacesFromString(event.target.value);
      onChange(cleanName);
    },
    [onChange],
  );

  if (isEditMode) {
    return (
      <div
        className={classNames('flex w-full flex-row items-center bg-layer-2')}
      >
        <input
          className={classNames(
            'h-[24px] border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none',

            isErrors && '!border-b-error',
            inputClassName,
          )}
          value={value}
          onChange={onChangeHandler}
          placeholder={placeholder}
        />

        <ErrorTooltip
          hideTooltip={!isErrors}
          tooltip={(errors ?? []).map((error) => (
            <p key={error}>{error}</p>
          ))}
          triggerClassName={classNames('absolute', tooltipIconClassName)}
        />
      </div>
    );
  }

  return (
    <Tooltip
      tooltip={value}
      triggerClassName={classNames('w-full truncate whitespace-pre', className)}
      contentClassName="break-all"
      dataQa="entity-name"
    >
      {value}
    </Tooltip>
  );
};
