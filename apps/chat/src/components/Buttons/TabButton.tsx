import { ReactNode } from 'react';

import classNames from 'classnames';

interface Props {
  children: ReactNode | ReactNode[];
  selected?: boolean;
  onClick: () => void;
  dataQA?: string;
}

export const TabButton = ({ children, selected, onClick, dataQA }: Props) => (
  <button
    className={classNames(
      'rounded border-b-2 px-3 py-2 hover:bg-accent-primary-alpha',
      selected
        ? 'border-accent-primary bg-accent-primary-alpha'
        : 'border-primary bg-layer-4 hover:border-transparent',
    )}
    onClick={onClick}
    data-qa={dataQA ?? 'tab-button'}
  >
    {children}
  </button>
);
