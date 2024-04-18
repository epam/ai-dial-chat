import { DialFile, DialLink } from '@/src/types/files';

import Tooltip from '../../Common/Tooltip';
import { ChatInputFileAttachment } from './ChatInputFileAttachment';
import { ChatInputLinkAttachment } from './ChatInputLinkAttachment';

interface Props {
  files?: Pick<DialFile, 'name' | 'id' | 'status' | 'percent'>[];
  onUnselectFile?: (fileId: string) => void;
  onRetryFile?: (fileId: string) => void;

  links?: DialLink[];
  onUnselectLink?: (index: number) => void;
}

export const ChatInputAttachments = ({
  files,
  links,
  onUnselectFile,
  onUnselectLink,
  onRetryFile,
}: Props) => {
  if (!files?.length && !links?.length) {
    return null;
  }

  return (
    <>
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
