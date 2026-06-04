import { FC } from 'react';

interface Props {
  text: string;
  dataQa?: string;
}

export const TranscribingOverlay: FC<Props> = ({ text, dataQa }) => {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded bg-layer-3"
      data-qa={dataQa}
    >
      <div className="flex items-center gap-2">
        <div className="size-4 animate-spin rounded-full border-2 border-x-transparent border-b-transparent border-t-current text-secondary" />
        <span className="text-sm text-secondary">
          {text.replace(/\.+$/, '')}
          <span className="inline-flex w-[1.2em] text-start" aria-hidden="true">
            <span className="animate-pulse">.</span>
            <span className="animate-pulse [animation-delay:200ms]">.</span>
            <span className="animate-pulse [animation-delay:400ms]">.</span>
          </span>
        </span>
      </div>
    </div>
  );
};
