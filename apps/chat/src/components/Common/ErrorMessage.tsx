import { IconAlertTriangle, IconExclamationCircle } from '@tabler/icons-react';

import classNames from 'classnames';

enum MessageType {
  ERROR = 'error',
  WARNING = 'warning',
}

export interface Props {
  error?: string;
  type?: 'error' | 'warning';
}

export const ErrorMessage = ({ error, type = MessageType.ERROR }: Props) => {
  if (!error?.length) {
    return null;
  }

  const isErrorMessage = type === MessageType.ERROR;
  const Icon = isErrorMessage ? IconExclamationCircle : IconAlertTriangle;

  return (
    <div
      className={classNames(
        'flex w-full gap-3 rounded border p-3',
        isErrorMessage ? 'border-error bg-error' : 'border-warning bg-warning',
      )}
      data-qa="error-message-container"
    >
      <span
        className={classNames(
          'flex shrink-0 items-center',
          isErrorMessage ? 'text-error' : 'text-warning',
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
