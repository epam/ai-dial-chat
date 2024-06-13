import { DialFile, DialLink, FileFolderInterface } from '@/src/types/files';

import Tooltip from '../../Common/Tooltip';
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
          triggerClassName={'truncate text-center'}
        >
          <ChatInputFolderAttachment
            folder={folder}
            onUnselect={onUnselectFile}
          />
        </Tooltip>
      ))}
      {files?.map((file) => (
        <Tooltip
          key={file.id}
          tooltip={file.name}
          triggerClassName={'truncate text-center'}
        >
          <ChatInputFileAttachment
            file={file}
            onUnselectFile={onUnselectFile}
            onRetryFile={onRetryFile}
          />
        </Tooltip>
      ))}
      {links?.map((link, index) => (
        <Tooltip
          key={index}
          tooltip={link.title || link.href}
          triggerClassName={'truncate text-center'}
        >
          <ChatInputLinkAttachment
            link={link}
            onUnselect={onUnselectLink && (() => onUnselectLink(index))}
          />
        </Tooltip>
      ))}
    </>
  );
};
