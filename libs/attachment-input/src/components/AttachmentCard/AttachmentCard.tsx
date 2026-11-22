import { type FC } from 'react';
import { useAttachmentCardComponent } from '../../context/AttachmentCardContext';
import type { AttachmentCardProps } from '../../models/attachment-card';
import { TileAttachmentCard } from './TileAttachmentCard';

/** Card for a single attachment: the host's component from `AttachmentCardProvider` when one is mounted, otherwise the built-in square tile. */
export const AttachmentCard: FC<AttachmentCardProps> = (props) => {
  const HostCard = useAttachmentCardComponent();

  if (HostCard) {
    return <HostCard {...props} />;
  }
  return <TileAttachmentCard {...props} />;
};
