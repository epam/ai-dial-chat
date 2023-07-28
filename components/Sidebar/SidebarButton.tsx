import { FC } from 'react';

import classNames from 'classnames';

interface Props {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
  className?: string;
}

export const SidebarButton: FC<Props> = ({
  text,
  icon,
  onClick,
  className = 'w-full',
}) => {
  return (
    <button
      className={classNames(
        'hover:bg-gray-500/10 flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-3 text-[14px] leading-3 text-white transition-colors duration-200',
        className,
      )}
      onClick={onClick}
    >
      <div>{icon}</div>
      <span>{text}</span>
    </button>
  );
};
