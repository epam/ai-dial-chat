import { IconArrowDown } from '@tabler/icons-react';

import classNames from 'classnames';

interface Props {
  onScrollDownClick: () => void;
  containerClassNames?: string;
}
export const ScrollDownButton = ({
  onScrollDownClick,
  containerClassNames,
}: Props) => {
  return (
    <div
      className={classNames(
        'absolute  aspect-square h-11',
        containerClassNames,
      )}
    >
      <button
        className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 p-2 hover:bg-gray-400 dark:bg-gray-700 hover:dark:bg-gray-600"
        onClick={onScrollDownClick}
      >
        <IconArrowDown width={24} height={24} />
      </button>
    </div>
  );
};
