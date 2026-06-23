import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  DIAL_ICON_SIZE,
  DialNeutralButton,
  DialPrimaryButton,
  DialTag,
} from '@epam/ai-dial-ui-kit';
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
import { EntityBadge } from '../../EntityBadge/EntityBadge';
import { FolderPath } from '../../FolderPath/FolderPath';
import { ItemHeader } from '../../ItemHeader/ItemHeader';
import styles from '../DetailsPanel.module.scss';
import { EntityHeader } from '../../EntityHeader/EntityHeader';

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
  const { nameClassName = 'dial-display-2-text' } =
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
        featuredLabel={texts?.featuredLabel ?? 'Featured'}
      />
      <div className="flex flex-col gap-1 pl-[56px]">
        <FolderPath segments={item.folder} />
        <div className="mt-3 flex flex-wrap gap-2">
          <DialPrimaryButton
            label={
              texts?.primaryActionLabel ??
              texts?.useInChatLabel ??
              'Use in chat'
            }
            iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
            onClick={handleUseInChat}
          />
          <DialNeutralButton
            appearance={ButtonAppearance.Outlined}
            label={texts?.shareLabel ?? 'Share'}
            iconBefore={<IconShare size={DIAL_ICON_SIZE.MD} />}
            iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
            onClick={handleShare}
          />
        </div>
      </div>
    </div>
  );
};
