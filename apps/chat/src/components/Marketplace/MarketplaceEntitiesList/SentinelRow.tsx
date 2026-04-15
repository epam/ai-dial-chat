import { ReactNode } from 'react';

import classNames from 'classnames';

interface Props {
  children: ReactNode;
  isTable?: boolean;
}

export function SentinelRow({ children, isTable }: Props) {
  return (
    <h2
      className={classNames(
        'col-span-full flex items-center pb-2 text-xl font-semibold',
        isTable && 'pl-4',
      )}
    >
      {children}
    </h2>
  );
}
