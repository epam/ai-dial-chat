import { IconFileImport } from '@tabler/icons-react';
import { FC, useRef } from 'react';

import { ImportConversationsHandler } from '../Chatbar/Chatbar.context';
import { ImportPromptsHandler } from '../Promptbar/PromptBar.context';
import { SidebarButton } from '../Sidebar/SidebarButton';

interface Props {
  text: string;
  onImport: ImportConversationsHandler | ImportPromptsHandler;
  type: 'conversations' | 'prompts';
}

export const Import: FC<Props> = ({ onImport, text, type }) => {
  const ref = useRef(null);
  const inputId = `import-${type}-file`;
  return (
    <>
      <input
        ref={ref}
        id={inputId}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".json"
        onChange={(e) => {
          if (!e.target.files?.length) return;

          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            let json = JSON.parse(readerEvent.target?.result as string);
            onImport(json);
            (ref.current as unknown as HTMLInputElement).value = '';
          };
          reader.readAsText(file);
        }}
      />

      <SidebarButton
        text={text}
        icon={<IconFileImport size={18} />}
        onClick={() => {
          const importFile = document.querySelector(
            `#${inputId}`,
          ) as HTMLInputElement;
          if (importFile) {
            importFile.click();
          }
        }}
      />
    </>
  );
};
