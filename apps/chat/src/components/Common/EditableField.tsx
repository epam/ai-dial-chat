import classNames from 'classnames';

import { Tooltip } from './Tooltip';

interface Props {
  value: string;
  isEditMode: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export const EditableField: React.FC<Props> = ({
  value,
  isEditMode,
  className,
  inputClassName,
  placeholder,
  onChange,
}) => {
  if (isEditMode) {
    return (
      <input
        className={classNames(
          'h-[24px] border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none',
          inputClassName,
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <Tooltip
      tooltip={value}
      contentClassName="max-w-[400px] break-all"
      triggerClassName={classNames('w-full truncate whitespace-pre', className)}
      dataQa="entity-name"
    >
      {value}
    </Tooltip>
  );
};
