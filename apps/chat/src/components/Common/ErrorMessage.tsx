import { IconAlertTriangle, IconExclamationCircle } from '@tabler/icons-react';

import classNames from 'classnames';

export interface Props {
  error?: string;
  type?: 'error' | 'warning';
}

export const ErrorMessage = ({ error, type = 'error' }: Props) => {
  if (!error?.length) {
    return null;
  }

  const Icon = type === 'error' ? IconExclamationCircle : IconAlertTriangle;

  return (
    <div
      className={classNames(
        'flex w-full gap-3 rounded border p-3',
        type === 'warning' && 'border-warning bg-warning',
        type === 'error' && 'border-error bg-error',
      )}
    >
      <span
        className={classNames(
          'flex shrink-0 items-center',
          type === 'error' ? 'text-error' : 'text-warning',
        )}
      >
        <Icon size={24} />
      </span>
      <span className="truncate whitespace-pre-wrap" data-qa="error-text">
        {error}
      </span>
    </div>
  );
};
