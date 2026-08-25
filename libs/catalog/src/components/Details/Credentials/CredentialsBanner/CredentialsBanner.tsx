import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import {
  IconBuildingCommunity,
  IconCircleCheckFilled,
  IconUser,
} from '@tabler/icons-react';
import { FC, ReactNode } from 'react';
import type { ItemDetailsTexts } from '../../../../models/item-details-props';
import {
  CredentialsBannerState,
  ToolsetAuthenticationType,
} from '../../../../types/toolset-auth';
import { CredentialsInfoCard } from '../CredentialsInfoCard/CredentialsInfoCard';
import styles from './CredentialsBanner.module.scss';

/** Props for {@link CredentialsBanner}. */
interface CredentialsBannerProps {
  /** Which banner copy to show. */
  state: CredentialsBannerState;
  /** Authentication mechanism the banner's wording should refer to. */
  authenticationType: ToolsetAuthenticationType;
  /** Text overrides. */
  texts?: ItemDetailsTexts;
}

const defaultOrgFallbackBannerTitle = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'You are currently using organization API key to access this toolset.'
    : 'You are currently using organization credentials to access this toolset.';

const defaultOrgFallbackBannerDescription = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Configure your personal API key to have access to your data.'
    : 'Login using personal account to have access to your data.';

const defaultOrgCredentialsActiveBannerTitle = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Signed in with organization API key.'
    : 'Signed in with organization credentials.';

const defaultPersonalCredentialsActiveBannerTitle = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Signed in with personal API key.'
    : 'Signed in with personal credentials.';

const BANNER_ICON_SIZE = 20;

/**
 * Icon-box chip with an overlapping checkmark badge, shown only for the two
 * "active" banner states — the fallback nudge below renders a bare icon
 * instead, matching the design's distinction between "in effect" and "not
 * yet configured".
 */
const ActiveCredentialsIcon: FC<{ icon: ReactNode }> = ({ icon }) => (
  <span className="relative inline-flex shrink-0">
    <span
      className={mergeClasses(
        'flex size-8 items-center justify-center rounded-lg',
        styles.iconBox,
      )}
    >
      {icon}
    </span>
    <IconCircleCheckFilled
      size={DIAL_ICON_SIZE.MD}
      aria-hidden
      className={mergeClasses('absolute -end-2 -top-2', styles.activeIcon)}
    />
  </span>
);

/** Informational banner below the details header about which credentials are active: a fallback nudge for a non-admin, or an active-status note for an admin. */
export const CredentialsBanner: FC<CredentialsBannerProps> = ({
  state,
  authenticationType,
  texts,
}) => {
  /* Color comes from `CredentialsInfoCard`'s icon slot, which the icon inherits. */
  const orgIcon = <IconBuildingCommunity size={BANNER_ICON_SIZE} aria-hidden />;

  if (state === CredentialsBannerState.PersonalCredentialsActive) {
    const title = (
      texts?.personalCredentialsActiveBannerTitle ??
      defaultPersonalCredentialsActiveBannerTitle
    )(authenticationType);
    return (
      <CredentialsInfoCard
        icon={
          <ActiveCredentialsIcon
            icon={<IconUser size={DIAL_ICON_SIZE.SM} aria-hidden />}
          />
        }
        title={title}
      />
    );
  }

  if (state === CredentialsBannerState.OrgCredentialsActive) {
    const title = (
      texts?.orgCredentialsActiveBannerTitle ??
      defaultOrgCredentialsActiveBannerTitle
    )(authenticationType);
    return (
      <CredentialsInfoCard
        icon={
          <ActiveCredentialsIcon
            icon={
              <IconBuildingCommunity size={DIAL_ICON_SIZE.SM} aria-hidden />
            }
          />
        }
        title={title}
      />
    );
  }

  const title = (
    texts?.orgFallbackBannerTitle ?? defaultOrgFallbackBannerTitle
  )(authenticationType);
  const description = (
    texts?.orgFallbackBannerDescription ?? defaultOrgFallbackBannerDescription
  )(authenticationType);

  return (
    <CredentialsInfoCard
      icon={orgIcon}
      title={title}
      description={description}
    />
  );
};
