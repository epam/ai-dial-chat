import { IconLogin, IconLogout } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useToolsetMenuActions } from '@/src/hooks/useToolsetActions';
import { useToolsetMenuItems } from '@/src/hooks/useToolsetMenuItems';

import {
  getToolsetAuthAction,
  getToolsetAuthActionLabel,
} from '@/src/utils/app/toolsets';

import { ScreenState } from '@/src/types/common';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { ToolsetAuthAction } from '@/src/constants/toolsets';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { IconButton } from '@/src/components/Common/IconButton';
import { ToolsetContextMenu } from '@/src/components/Marketplace/EntityContextMenu/ToolsetContextMenu';

import { AgentBookmark } from '../AgentBookmark';

interface Props {
  entity: ToolsetModel;
  allVersions: ToolsetModel[];
  onChangeVersion: (entity: ToolsetModel) => void;
  onBookmarkClick: (entity: ToolsetModel) => void;
}

export function ToolsetDetailsFooter({
  entity,
  allVersions,
  onChangeVersion,
  onBookmarkClick,
}: Props) {
  const { t } = useTranslation(Translation.Marketplace);
  const screenState = useScreenState();
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const { handleLogin } = useToolsetMenuActions(entity);

  const showContextMenu =
    entity.reference !== entity.id && screenState === ScreenState.SM;

  const authAction = getToolsetAuthAction(entity, isAdmin);

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

  const LoginIcon = useMemo(
    () => (authAction === ToolsetAuthAction.LogOut ? IconLogout : IconLogin),
    [authAction],
  );

  return (
    <section className="flex px-3 py-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {showContextMenu ? (
            <button className="icon-button">
              <ToolsetContextMenu
                className="xl:invisible group-hover:xl:visible"
                triggerIconSize={24}
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

          <AgentBookmark
            entity={entity}
            size={24}
            className="icon-button group/bookmark"
            onBookmarkClick={onBookmarkClick}
          />
        </div>
        <div className="flex w-full min-w-0 items-center justify-end gap-4">
          <ModelVersionSelect
            className="truncate"
            entities={allVersions}
            currentEntity={entity}
            showVersionPrefix
            onSelect={onChangeVersion}
          />

          <button
            onClick={handleLogin}
            className={classNames('button flex items-center gap-2', {
              'button-primary text-primary':
                authAction === ToolsetAuthAction.LogIn ||
                authAction === ToolsetAuthAction.LoginWithMyCreds,
              'button-secondary': authAction === ToolsetAuthAction.LogOut,
            })}
          >
            <LoginIcon size={18} />
            {t(getToolsetAuthActionLabel(authAction, screenState))}
          </button>
        </div>
      </div>
    </section>
  );
}
