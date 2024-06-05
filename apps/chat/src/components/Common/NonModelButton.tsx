import { ReactElement } from 'react';

import classNames from 'classnames';

interface Props {
  icon: ReactElement;
  buttonLabel: string;
  isSelected?: boolean;
  onClickHandler?: () => void;
}

export const NonModelButton = ({
  icon,
  buttonLabel,
  isSelected,
  onClickHandler,
}: Props) => {
  const asIsButtonClassName = classNames(
    'flex items-center gap-3 rounded-primary border px-3 py-2 text-left text-xs hover:border-tertiary hover:bg-accent-secondary-alpha',
    isSelected
      ? 'border-accent-quaternary bg-accent-secondary-alpha'
      : 'border-secondary',
  );

  return (
    <button
      className={asIsButtonClassName}
      onClick={onClickHandler}
      data-qa={buttonLabel}
    >
      <span className="relative inline-block shrink-0 leading-none">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <span>{buttonLabel}</span>
      </div>
    </button>
  );
};
