interface Props {
  appName: string;
  conversationName: string;
}

export const PlaybackEmptyInfo = ({ appName, conversationName }: Props) => {
  return (
    <div className="flex h-full w-full flex-col items-center px-3 pt-5">
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded bg-gray-200 p-4 dark:bg-gray-800 lg:mx-auto lg:max-w-3xl">
        <h4 className="w-full text-center text-xl font-semibold">{appName}</h4>

        <h4 className="flex w-full justify-center text-center text-base font-semibold">
          <span className="overflow-auto">{conversationName}</span>
        </h4>
      </div>
    </div>
  );
};
