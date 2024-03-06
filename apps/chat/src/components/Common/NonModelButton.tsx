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
    'flex items-center gap-3 rounded border p-3 text-left text-xs hover:border-hover',
    isSelected ? 'border-accent-primary' : 'border-primary',
  );

  return (
    <button className={asIsButtonClassName} onClick={onClickHandler}>
      <span className="relative inline-block shrink-0 leading-none">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <span>{buttonLabel}</span>
      </div>
    </button>
  );
};
