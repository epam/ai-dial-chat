import { IconBuildingCommunity, IconUser } from '@tabler/icons-react';
import { FC } from 'react';
import type { ItemDetailsTexts } from '../../../../models/item-details-props';
import {
  CredentialsBannerState,
  ToolsetAuthenticationType,
} from '../../../../types/toolset-auth';
import { CredentialsInfoCard } from '../CredentialsInfoCard/CredentialsInfoCard';

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
        icon={<IconUser size={BANNER_ICON_SIZE} aria-hidden />}
        title={title}
      />
    );
  }

  if (state === CredentialsBannerState.OrgCredentialsActive) {
    const title = (
      texts?.orgCredentialsActiveBannerTitle ??
      defaultOrgCredentialsActiveBannerTitle
    )(authenticationType);
    return <CredentialsInfoCard icon={orgIcon} title={title} />;
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
