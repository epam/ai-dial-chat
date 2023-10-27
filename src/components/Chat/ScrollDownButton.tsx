import { IconArrowDown } from '@tabler/icons-react';

interface Props {
  onScrollDownClick: () => void;
}
export const ScrollDownButton = ({ onScrollDownClick }: Props) => {
  return (
    <div className="absolute -top-14 right-0 aspect-square h-11 xl:bottom-0 xl:right-[-70px] xl:top-auto">
      <button
        className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 p-2 hover:bg-gray-400 dark:bg-gray-700 hover:dark:bg-gray-600"
        onClick={onScrollDownClick}
      >
        <IconArrowDown width={24} height={24} />
      </button>
    </div>
  );
};
