import { IconExclamationCircle } from '@tabler/icons-react';

export interface Props {
  error?: string;
}

export const ErrorMessage = ({ error }: Props) => {
  if (!error?.length) {
    return null;
  }

  return (
    <div className="flex w-full gap-3 rounded border border-error bg-error p-3">
      <span className="flex shrink-0 items-center text-error">
        <IconExclamationCircle size={24} />
      </span>
      <span className="truncate whitespace-pre-wrap" data-qa="error-text">
        {error}
      </span>
    </div>
  );
};
