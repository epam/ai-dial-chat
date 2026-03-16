import { IconLink } from '@tabler/icons-react';

import { DialLink } from '@/src/types/files';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';

interface Props {
  link: DialLink;

  onUnselect?: () => void;
}

export const ChatInputLinkAttachment = ({ link, onUnselect }: Props) => {
  return (
    <div className="flex items-center gap-3 rounded border border-primary bg-layer-1 px-3 py-2">
      <IconLink className="shrink-0 text-secondary" size={18} />

      <div className="flex grow justify-between gap-3 overflow-hidden">
        <div className="flex grow flex-col overflow-hidden text-sm">
          <span className="block max-w-full truncate text-start">
            {link.title || link.href}
          </span>
        </div>
        {onUnselect && (
          <div className="flex gap-3">
            <CloseButtonSmall onClick={() => onUnselect()} />
          </div>
        )}
      </div>
    </div>
  );
};
