import { IconKey, IconLogin, IconLogout } from '@tabler/icons-react';
import { FC, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useToolsetMenuActions } from '@/src/hooks/useToolsetActions';

import { isEntityIdPublic } from '@/src/utils/app/publications';
import {
  getToolsetAuthAction,
  getToolsetAuthActionLabel,
  isToolsetWithAuth,
} from '@/src/utils/app/toolsets';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { ToolsetAuthAction } from '@/src/constants/toolsets';

import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

interface LoginButtonProps {
  entity: ToolsetModel;
}

export const LoginButton: FC<LoginButtonProps> = ({ entity }) => {
  const { t } = useTranslation(Translation.Marketplace);
  const screenState = useScreenState();

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const isPublic = isEntityIdPublic(entity);
  const withAuth = isToolsetWithAuth(entity);
  const { handleLogin } = useToolsetMenuActions(entity);
  const authAction = getToolsetAuthAction(entity, isAdmin);

  const isOrganizationView = isPublic && isAdmin;

  const LoginIcon = useMemo(
    () => (authAction === ToolsetAuthAction.LogOut ? IconLogout : IconLogin),
    [authAction],
  );

  if (!withAuth) return null;

  if (isOrganizationView)
    return (
      <DialButton
        iconBefore={<IconKey size={18} />}
        onClick={handleLogin}
        label={t('Manage creds') as string}
        variant={ButtonVariant.Primary}
        data-qa="login-button"
      />
    );

  return (
    <DialButton
      onClick={handleLogin}
      label={t(getToolsetAuthActionLabel(authAction, screenState)) as string}
      iconBefore={<LoginIcon size={18} />}
      variant={
        authAction === ToolsetAuthAction.LogOut
          ? ButtonVariant.Secondary
          : ButtonVariant.Primary
      }
      data-qa="login-button"
    />
  );
};
