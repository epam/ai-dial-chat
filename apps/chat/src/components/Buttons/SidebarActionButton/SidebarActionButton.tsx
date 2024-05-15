import { MouseEventHandler, ReactElement } from 'react';

interface Props {
  handleClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactElement;
}

const SidebarActionButton = ({ handleClick, children }: Props) => (
  <button
    className={`min-w-[20px] p-1 text-secondary-bg-dark`}
    onClick={handleClick}
    data-qa="action-button"
  >
    {children}
  </button>
);

export default SidebarActionButton;
