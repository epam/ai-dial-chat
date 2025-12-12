import { IconKey, IconLogin, IconLogout } from '@tabler/icons-react';
import { FC, useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useToolsetMenuActions } from '@/src/hooks/useToolsetActions';

import { isEntityIdPublic } from '@/src/utils/app/publications';
import {
  getToolsetAuthAction,
  getToolsetAuthActionLabel,
  isToolsetWithAuth,
} from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { ToolsetAuthAction } from '@/src/constants/toolsets';

interface LoginButtonProps {
  entity: ToolsetModel;
}

export const LoginButton: FC<LoginButtonProps> = ({ entity }) => {
  const { t } = useTranslation(Translation.Marketplace);
  const screenState = useScreenState();

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const isPublic = isEntityIdPublic(entity);
  const withAuth = isToolsetWithAuth(entity);
  const { handleLogin, handleLogout } = useToolsetMenuActions(entity);
  const authAction = getToolsetAuthAction(entity, isAdmin);

  const isOrganizationView = isPublic && isAdmin;

  const LoginIcon = useMemo(
    () => (authAction === ToolsetAuthAction.LogOut ? IconLogout : IconLogin),
    [authAction],
  );

  const handleUserLogin = useCallback(
    (e: React.MouseEvent) => {
      if (authAction === ToolsetAuthAction.LogOut) {
        handleLogout(ToolsetCredentialsLevel.GLOBAL);
      } else {
        handleLogin(e);
      }
    },
    [authAction, handleLogin, handleLogout],
  );

  if (!withAuth) return null;

  if (isOrganizationView)
    return (
      <button
        onClick={handleLogin}
        className="button button-primary flex items-center gap-2"
        data-qa="login-button"
      >
        <IconKey size={18} />
        {t('Manage creds')}
      </button>
    );

  return (
    <button
      onClick={handleUserLogin}
      className={classNames('button flex items-center gap-2', {
        'button-primary text-primary':
          authAction === ToolsetAuthAction.LogIn ||
          authAction === ToolsetAuthAction.LoginWithMyCreds,
        'button-secondary': authAction === ToolsetAuthAction.LogOut,
      })}
      data-qa="login-button"
    >
      <LoginIcon size={18} />
      {t(getToolsetAuthActionLabel(authAction, screenState))}
    </button>
  );
};
