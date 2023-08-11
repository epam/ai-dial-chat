import CicrleExclamation from '../../public/images/icons/circle-exclamation.svg';

export interface Props {
  error: string;
}

export const MessageError = ({ error }: Props) => {
  return (
    <div className="flex w-full gap-3 rounded bg-red-200 p-3 text-red-800 dark:bg-red-900 dark:text-red-400">
      <span className="flex shrink-0 items-center">
        <CicrleExclamation height={24} width={24}></CicrleExclamation>
      </span>
      <span>{error}</span>
    </div>
  );
};
