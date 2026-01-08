import { IconFile, IconTrashX } from '@tabler/icons-react';
import { FC } from 'react';

import classNames from 'classnames';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props {
  document: string;
  readonly?: boolean;
  onRemove?: (document: string) => void;
}

export const SelectedFile: FC<Props> = ({ document, readonly, onRemove }) => {
  const last = document.lastIndexOf('/');
  const path = document.substring(0, last).split('/').slice(2).join('/');
  const name = document.substring(last + 1, document.length);

  return (
    <Tooltip
      placement="top-start"
      tooltip={name}
      triggerClassName="items-center flex"
      contentClassName="text-primary"
    >
      <div className="flex w-full cursor-pointer flex-row items-center justify-between rounded p-2 hover:bg-accent-primary-alpha">
        <IconFile size={18} className="text-secondary" />
        <div className="ml-2 flex min-w-0 flex-1 flex-col pr-2">
          <span
            className={classNames(
              'w-full truncate text-sm leading-4 text-primary',
              path && 'mb-1.5',
            )}
          >
            {name}
          </span>

          <span className="w-full truncate text-xs leading-[15px] text-secondary">
            {path}
          </span>
        </div>
        {!readonly && onRemove && (
          <IconTrashX
            className="text-secondary hover:text-accent-primary"
            onClick={() => onRemove(document)}
            size={18}
          />
        )}
      </div>
    </Tooltip>
  );
};
