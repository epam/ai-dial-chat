import { IconFolder } from '@tabler/icons-react';

import { FileFolderInterface } from '@/src/types/files';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface Props {
  folder: FileFolderInterface;
  onUnselect?: (folderId: string) => void;
}

export const ChatInputFolderAttachment = ({ folder, onUnselect }: Props) => {
  return (
    <div className="flex items-center gap-3 rounded border border-primary bg-layer-1 px-3 py-2">
      <IconFolder className="shrink-0 text-secondary" size={18} />

      <div className="flex grow justify-between gap-3 overflow-hidden">
        <div className="flex grow flex-col overflow-hidden text-sm">
          <span
            className="block max-w-full text-start"
            data-qa="attached-folder-name"
          >
            <DialEllipsisTooltip text={folder.name} />
          </span>
        </div>
        {onUnselect && (
          <div className="flex gap-3">
            <CloseButtonSmall onClick={() => onUnselect(`${folder.id}/`)} />
          </div>
        )}
      </div>
    </div>
  );
};
