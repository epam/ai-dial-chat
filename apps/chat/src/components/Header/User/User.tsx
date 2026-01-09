import { FC } from 'react';

import classNames from 'classnames';

import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { ProfileButton } from './ProfileButton';
import { UserDesktop } from './UserDesktop';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  className?: string;
}

const UserView: FC<Props> = ({ className }) => {
  return (
    <div
      className={classNames('w-[48px] overflow-hidden md:w-auto', className)}
    >
      <div className="flex h-full items-center justify-center md:hidden">
        <ProfileButton />
      </div>

      <div className="hidden size-full md:block">
        <UserDesktop />
      </div>
    </div>
  );
};

export const User = withRenderWhen(
  (state) => !SettingsSelectors.isFeatureEnabled(state, Feature.HideUserMenu),
)(UserView);
