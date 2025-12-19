import { MouseEventHandler, ReactElement } from 'react';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  handleClick: MouseEventHandler<HTMLButtonElement>;
  iconBefore?: ReactElement;
  iconAfter?: ReactElement;
  label?: string;
  dataQA?: string;
}

export const SidebarActionButton = ({
  handleClick,
  iconBefore,
  iconAfter,
  label,
  dataQA,
}: Props) => (
  <DialButton
    className="min-w-[20px] p-1 text-secondary"
    onClick={handleClick}
    iconBefore={iconBefore}
    iconAfter={iconAfter}
    label={label}
    data-qa={dataQA ?? 'action-button'}
  />
);
