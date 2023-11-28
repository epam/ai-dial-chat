import { IconExclamationCircle } from '@tabler/icons-react';

export interface Props {
  error?: string;
}

export const ErrorMessage = ({ error }: Props) => {
  if (!error) {
    return null;
  }

  return (
    <div className="flex w-full gap-3 rounded bg-red-200 p-3 text-red-800 dark:bg-red-900 dark:text-red-400">
      <span className="flex shrink-0 items-center">
        <IconExclamationCircle size={24} />
      </span>
      <span>{error}</span>
    </div>
  );
};
