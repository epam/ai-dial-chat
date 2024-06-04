import { IconExclamationCircle } from '@tabler/icons-react';

export interface Props {
  error?: string;
}

export const ErrorMessage = ({ error }: Props) => {
  if (!error?.length) {
    return null;
  }

  return (
    <div className="flex w-full gap-3 rounded bg-error p-3 text-error">
      <span className="flex shrink-0 items-center">
        <IconExclamationCircle size={24} />
      </span>
      <span className="truncate whitespace-pre-wrap" data-qa="error-text">
        {error}
      </span>
    </div>
  );
};
