import { useMemo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useToolsetMenuItems } from '@/src/hooks/useToolsetMenuItems';

import { ScreenState } from '@/src/types/common';

import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { IconButton } from '@/src/components/Common/IconButton';
import { MarketplaceEntityContextMenu } from '@/src/components/Marketplace/EntityContextMenu/MarketplaceEntityContextMenu';
import { MarketplaceEntityBookmark } from '@/src/components/Marketplace/MarketplaceEntityBookmark';
import { ToolsetRepairButton } from '@/src/components/Marketplace/ToolsetRepairButton';
import { LoginButton } from '@/src/components/Marketplace/ToolsetsDetails/LoginButton';
import { ToolsetDetailsFooterProps } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

export function ToolsetDetailsFooter({
  entity,
  allVersions,
  onChangeVersion,
  onBookmarkClick,
}: ToolsetDetailsFooterProps) {
  const screenState = useScreenState();

  const showContextMenu =
    entity.reference !== entity.id && screenState === ScreenState.SM;

  const toolsetMenuItemsParams = useMemo(
    () => ({
      entity,
      disabledActions: {
        copyLink: screenState !== ScreenState.SM,
        share: !showContextMenu,
        unshare: !entity?.sharedWithMe,
        login: true,
      },
    }),
    [entity, screenState, showContextMenu],
  );

  const menuItems = useToolsetMenuItems(toolsetMenuItemsParams);
  const filteredMenuItems = useMemo(
    () => menuItems.filter((item) => item.display),
    [menuItems],
  );

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {showContextMenu ? (
            <button className="icon-button">
              <MarketplaceEntityContextMenu
                className="xl:invisible group-hover:xl:visible"
                triggerIconSize={DEFAULT_ICON_SIZES.STANDARD}
                entity={entity}
              />
            </button>
          ) : (
            filteredMenuItems.map(
              ({ name, className, iconClassName, ...props }) => (
                <IconButton
                  key={name}
                  name={name}
                  className={classNames(iconClassName, className)}
                  {...props}
                />
              ),
            )
          )}

          {onBookmarkClick && (
            <MarketplaceEntityBookmark
              entity={entity}
              size={DEFAULT_ICON_SIZES.STANDARD}
              className="icon-button group/bookmark"
              onBookmarkClick={onBookmarkClick}
            />
          )}
        </div>
        <div className="flex w-full min-w-0 items-center justify-end gap-4">
          <ModelVersionSelect
            className="truncate"
            entities={allVersions}
            currentEntity={entity}
            showVersionPrefix
            onSelect={onChangeVersion}
          />

          <LoginButton entity={entity} />

          <ToolsetRepairButton toolset={entity} />
        </div>
      </div>
    </section>
  );
}
