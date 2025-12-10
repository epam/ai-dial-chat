import { IconLogin, IconLogout } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useToolsetMenuActions } from '@/src/hooks/useToolsetActions';

import {
  getToolsetAuthAction,
  getToolsetAuthActionLabel,
  isToolsetWithAuth,
} from '@/src/utils/app/toolsets';

import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { ToolsetAuthAction } from '@/src/constants/toolsets';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { ToolsetDetailsFooterProps } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

export const SimpleToolsetDetailsFooter: React.FC<
  ToolsetDetailsFooterProps
> = ({ entity, onChangeVersion, onRemove }) => {
  const { t } = useTranslation(Translation.Marketplace);
  const screenState = useScreenState();
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const { handleLogin } = useToolsetMenuActions(entity);
  const authAction = getToolsetAuthAction(entity, isAdmin);
  const withAuth = isToolsetWithAuth(entity);
  const LoginIcon = useMemo(
    () => (authAction === ToolsetAuthAction.LogOut ? IconLogout : IconLogin),
    [authAction],
  );

  return (
    <div className="flex items-center justify-end gap-4 p-4">
      <div className="flex items-center">
        <ModelVersionSelect
          className="h-max"
          entities={[entity]}
          onSelect={onChangeVersion}
          currentEntity={entity}
          showVersionPrefix
        />
      </div>

      <div className="flex items-center gap-2">
        {onRemove && (
          <button
            className="button button-secondary py-2"
            onClick={() => onRemove(entity)}
            data-qa="remove-from-details"
          >
            {t('Remove')}
          </button>
        )}

        {withAuth && (
          <button
            onClick={handleLogin}
            className={classNames('button flex items-center gap-2 py-2', {
              'button-primary':
                authAction === ToolsetAuthAction.LogIn ||
                authAction === ToolsetAuthAction.LoginWithMyCreds,
              'button-secondary': authAction === ToolsetAuthAction.LogOut,
            })}
          >
            <LoginIcon size={18} />
            {t(getToolsetAuthActionLabel(authAction, screenState))}
          </button>
        )}
      </div>
    </div>
  );
};
