import { IconAlertCircle } from '@tabler/icons-react';

export interface Props {
  error: string;
}

export const MessageError = ({ error }: Props) => {
  return (
    <div className="flex w-full gap-3 rounded bg-red-200 p-3 text-red-500">
      <span className="flex shrink-0 items-center">
        <IconAlertCircle size={22}></IconAlertCircle>
      </span>
      <span>{error}</span>
    </div>
  );
};
