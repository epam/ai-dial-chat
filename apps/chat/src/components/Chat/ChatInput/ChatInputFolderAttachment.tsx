import { IconFolder, IconX } from '@tabler/icons-react';

import { FileFolderInterface } from '@/src/types/files';

interface Props {
  folder: FileFolderInterface;
  onUnselect?: (folderId: string) => void;
}

export const ChatInputFolderAttachment = ({ folder, onUnselect }: Props) => {
  return (
    <div className="flex items-center gap-3 rounded border border-primary bg-layer-1 px-3 py-2">
      <IconFolder className="shrink-0 text-secondary-bg-light" size={18} />

      <div className="flex grow justify-between gap-3 overflow-hidden">
        <div className="flex grow flex-col overflow-hidden text-sm">
          <span className="block max-w-full truncate text-start">
            {folder.name || folder.id}
          </span>
        </div>
        {onUnselect && (
          <div className="flex gap-3">
            <button onClick={() => onUnselect(`${folder.id}/`)}>
              <IconX
                className="shrink-0 text-secondary-bg-light hover:text-accent-primary"
                size={18}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
