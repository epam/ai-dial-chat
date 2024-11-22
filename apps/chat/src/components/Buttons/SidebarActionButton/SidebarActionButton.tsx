import { MouseEventHandler, ReactElement } from 'react';

interface Props {
  handleClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactElement;
  dataQA?: string;
}

const SidebarActionButton = ({ handleClick, children, dataQA }: Props) => (
  <button
    className="min-w-[20px] p-1 text-secondary"
    onClick={handleClick}
    data-qa={dataQA ?? 'action-button'}
    type="button"
  >
    {children}
  </button>
);

export default SidebarActionButton;
