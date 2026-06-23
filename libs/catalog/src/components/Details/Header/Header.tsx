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
    <div className="flex shrink-0 gap-3.5 px-[22px] py-4">
      <DeploymentIcon src={item.iconUrl} size={52} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1">
          <EntityBadge type={item.type} />
          {item.isFeatured && (
            <DialTag
              label={texts?.featuredLabel ?? 'Featured'}
              className={mergeClasses('ms-auto px-[6px]', styles.featuredTag)}
            />
          )}
        </div>
        <ItemHeader
          titleClassName={nameClassName}
          title={item.name}
          postfix={item.version}
        />

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
