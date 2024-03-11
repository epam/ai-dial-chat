import { DialFile, DialLink } from '@/src/types/files';

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
