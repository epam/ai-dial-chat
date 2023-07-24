import { IconAlertCircle } from '@tabler/icons-react';

export interface Props {
  error: string;
}

export const MessageError = ({ error }: Props) => {
  return (
    <div className="w-full rounded bg-red-200 text-red-500 p-3 flex gap-3">
      <span className="shrink-0 flex items-center">
        <IconAlertCircle size={22}></IconAlertCircle>
      </span>
      <span>{error}</span>
    </div>
  );
};
