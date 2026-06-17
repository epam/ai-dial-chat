import { ReactNode } from 'react';

import classNames from 'classnames';

interface Props {
  children: ReactNode;
  dataQa: string;
  isTable?: boolean;
}

export function SentinelRow({ children, dataQa, isTable }: Props) {
  return (
    <h2
      className={classNames(
        'col-span-full pb-2 text-xl font-semibold',
        isTable && 'ps-4 pt-4',
      )}
      data-qa={dataQa}
    >
      {children}
    </h2>
  );
}
