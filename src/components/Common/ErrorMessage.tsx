import { IconExclamationCircle } from '@tabler/icons-react';

export interface Props {
  error?: string;
}

export const ErrorMessage = ({ error }: Props) => {
  if (!error) {
    return null;
  }

  return (
    <div className="bg-red-200 text-red-800 flex w-full gap-3 rounded p-3">
      <span className="flex shrink-0 items-center">
        <IconExclamationCircle size={24} />
      </span>
      <span>{error}</span>
    </div>
  );
};
