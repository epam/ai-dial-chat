import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE, DialDropdown } from '@epam/ai-dial-ui-kit';
import {
  IconChevronDown,
  IconPencil,
  IconPlayerPlayFilled,
  IconShare,
} from '@tabler/icons-react';
import { FC, type ReactNode, useCallback, useState } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import type {
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '../../../models/item-details-props';
import { CatalogEntityType } from '../../../types/entity-type';
import { EntityHeader } from '../../EntityHeader/EntityHeader';
import { FolderPath } from '../../FolderPath/FolderPath';

interface HeaderProps {
  item: CatalogItem;
  onUseInChat?: (item: CatalogItem) => void;
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  onShare?: (item: CatalogItem) => void;
  /**
   * Renders the Share popover content anchored to the Share button. When
   * provided, clicking Share opens this popover instead of calling `onShare`.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  onEdit?: (item: CatalogItem) => void;
  texts?: ItemDetailsTexts;
  detailsStyles?: ItemDetailsStyles;
}
/** Right-side slide-in panel displaying full details for a catalog item. */
export const Header: FC<HeaderProps> = ({
  item,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  shareOverlay,
  onEdit,
  texts,
  detailsStyles,
}) => {
  const {
    nameClassName = 'dial-body-semi-text text-primary',
    folderLabelClassName = 'dial-tiny-text',
    folderLeafClassName = 'dial-tiny-semi-text',
  } = detailsStyles?.typography ?? {};
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleUseInChat = useCallback(() => {
    onUseInChat?.(item);
  }, [item, onUseInChat]);

  const handleShare = useCallback(() => {
    if (shareOverlay) {
      setIsShareOpen((prev) => !prev);
      return;
    }
    onShare?.(item);
  }, [item, onShare, shareOverlay]);

  const handleEdit = useCallback(() => {
    onEdit?.(item);
  }, [item, onEdit]);

  const shouldShowPrimaryAction =
    texts?.hasPrimaryAction !== false &&
    (isPrimaryActionVisible?.(item) ??
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Application));

  /*
   * Guardrail and MCP sharing is descoped for now — hide Share entirely for
   * those types rather than offering a button with undefined behavior.
   * Sharing is also limited to entities the current user owns (deployments
   * and toolsets in their personal space), not the whole catalog.
   */
  const shouldShowShare =
    item.isMyApp === true &&
    item.type !== CatalogEntityType.Guardrail &&
    item.type !== CatalogEntityType.Mcp;

  const shouldShowEditAction = !!onEdit && !!item.isEditable;

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
              labelClassName={folderLabelClassName}
              leafClassName={folderLeafClassName}
            />
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-2 ps-[60px]">
        {shouldShowPrimaryAction && (
          <PrimaryButton
            label={texts?.primaryActionLabel ?? 'Use in chat'}
            iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
            onClick={handleUseInChat}
          />
        )}
        {shouldShowEditAction && (
          <NeutralButton
            label={texts?.editActionLabel ?? 'Edit'}
            iconBefore={<IconPencil size={DIAL_ICON_SIZE.MD} />}
            onClick={handleEdit}
          />
        )}
        {shouldShowShare &&
          (shareOverlay ? (
            <DialDropdown
              placement="bottom-end"
              matchReferenceWidth={false}
              open={isShareOpen}
              onOpenChange={setIsShareOpen}
              trigger={[]}
              outsideClosable
              listClassName="cp-dropdown-overlay"
              renderOverlay={() =>
                shareOverlay(item, () => setIsShareOpen(false))
              }
            >
              <NeutralButton
                label={texts?.shareLabel ?? 'Share'}
                iconBefore={<IconShare size={DIAL_ICON_SIZE.MD} />}
                iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
                onClick={handleShare}
              />
            </DialDropdown>
          ) : (
            <NeutralButton
              label={texts?.shareLabel ?? 'Share'}
              iconBefore={<IconShare size={DIAL_ICON_SIZE.MD} />}
              iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
              onClick={handleShare}
            />
          ))}
      </div>
    </div>
  );
};
