interface Props {
  appName: string;
  conversationName: string;
}

export const PlaybackEmptyInfo = ({ appName, conversationName }: Props) => {
  return (
    <div
      className="flex size-full flex-col items-center px-3 pt-5"
      data-qa="playback"
    >
      <div className="flex size-full flex-col items-center justify-center gap-2 rounded bg-layer-2 p-4 lg:mx-auto lg:max-w-3xl">
        <h4
          className="w-full text-center text-xl font-semibold"
          data-qa="app-name"
        >
          {appName}
        </h4>

        <h4
          className="flex w-full justify-center text-center text-base font-semibold"
          data-qa="conversation-name"
        >
          <span className="overflow-auto">{conversationName}</span>
        </h4>
      </div>
    </div>
  );
};
