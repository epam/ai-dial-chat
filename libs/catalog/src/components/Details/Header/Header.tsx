import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import {
  IconChevronDown,
  IconPlayerPlayFilled,
  IconShare,
} from '@tabler/icons-react';
import { FC, useCallback } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import type {
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '../../../models/item-details-props';
import { EntityHeader } from '../../EntityHeader/EntityHeader';
import { FolderPath } from '../../FolderPath/FolderPath';

interface HeaderProps {
  item: CatalogItem;
  onUseInChat?: (item: CatalogItem) => void;
  onShare?: (item: CatalogItem) => void;
  texts?: ItemDetailsTexts;
  detailsStyles?: ItemDetailsStyles;
}
/** Right-side slide-in panel displaying full details for a catalog item. */
export const Header: FC<HeaderProps> = ({
  item,
  onUseInChat,
  onShare,
  texts,
  detailsStyles,
}) => {
  const { nameClassName = 'dial-body-semi-text text-primary' } =
    detailsStyles?.typography ?? {};
  const handleUseInChat = useCallback(() => {
    onUseInChat?.(item);
  }, [item, onUseInChat]);

  const handleShare = useCallback(() => {
    onShare?.(item);
  }, [item, onShare]);

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <EntityHeader
        item={item}
        iconSize={52}
        nameClassName={nameClassName}
        featuredLabel={texts?.featuredLabel ?? 'Featured'}
        footer={
          item.folder.length > 0 ? (
            <FolderPath
              segments={item.folder}
              labelClassName="dial-tiny-text"
              leafClassName="dial-tiny-semi-text"
            />
          ) : undefined
        }
      />
      <div className="flex flex-wrap gap-2 ps-[60px]">
        <PrimaryButton
          label={
            texts?.primaryActionLabel ?? texts?.useInChatLabel ?? 'Use in chat'
          }
          iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
          onClick={handleUseInChat}
        />
        <NeutralButton
          label={texts?.shareLabel ?? 'Share'}
          iconBefore={<IconShare size={DIAL_ICON_SIZE.MD} />}
          iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
          onClick={handleShare}
        />
      </div>
    </div>
  );
};
