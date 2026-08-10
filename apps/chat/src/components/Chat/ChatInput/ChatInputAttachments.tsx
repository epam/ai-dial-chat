import { DialFile, DialLink, FileFolderInterface } from '@/src/types/files';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChatInputFileAttachment } from './ChatInputFileAttachment';
import { ChatInputFolderAttachment } from './ChatInputFolderAttachment';
import { ChatInputLinkAttachment } from './ChatInputLinkAttachment';

interface Props {
  files?: Pick<DialFile, 'name' | 'id' | 'status' | 'percent'>[];
  folders?: FileFolderInterface[];
  onUnselectFile?: (fileId: string) => void;
  onRetryFile?: (fileId: string) => void;
  links?: DialLink[];
  onUnselectLink?: (index: number) => void;
}

export const ChatInputAttachments = ({
  folders,
  files,
  links,
  onUnselectFile,
  onUnselectLink,
  onRetryFile,
}: Props) => {
  if (!files?.length && !links?.length && !folders?.length) {
    return null;
  }

  return (
    <>
      {folders?.map((folder) => (
        <Tooltip
          key={folder.id}
          tooltip={folder.name}
          triggerClassName={'truncate text-center shrink-0 min-w-o min-h-0'}
        >
          <ChatInputFolderAttachment
            folder={folder}
            onUnselect={onUnselectFile}
          />
        </Tooltip>
      ))}
      {files?.map((file) => (
        <ChatInputFileAttachment
          key={file.id}
          file={file}
          onUnselectFile={onUnselectFile}
          onRetryFile={onRetryFile}
        />
      ))}
      {links?.map((link, index) => (
        <ChatInputLinkAttachment
          key={index}
          link={link}
          onUnselect={onUnselectLink && (() => onUnselectLink(index))}
        />
      ))}
    </>
  );
};
