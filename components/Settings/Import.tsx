import { FC, ReactNode, useRef } from 'react';

import { ImportConversationsHandler } from '../Chatbar/Chatbar.context';
import { ImportPromptsHandler } from '../Promptbar/PromptBar.context';

interface Props {
  onImport: ImportConversationsHandler | ImportPromptsHandler;
  icon: ReactNode;
}

export const Import: FC<Props> = ({ onImport, icon }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".json"
        onChange={(e) => {
          if (!e.target.files?.length) return;

          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            const json = JSON.parse(readerEvent.target?.result as string);
            onImport(json);
            (ref.current as unknown as HTMLInputElement).value = '';
          };
          reader.readAsText(file);
        }}
      />
      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
        onClick={() => {
          const importFile = ref.current;
          if (importFile) {
            importFile.click();
          }
        }}
      >
        {icon}
      </div>
    </>
  );
};
