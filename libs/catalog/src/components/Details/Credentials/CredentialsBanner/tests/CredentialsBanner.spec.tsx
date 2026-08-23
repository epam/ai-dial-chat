import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CredentialsBannerState,
  ToolsetAuthenticationType,
} from '../../../../../types/toolset-auth';
import { CredentialsBanner } from '../CredentialsBanner';

vi.mock('@tabler/icons-react', () => ({
  IconBuildingCommunity: () => <svg />,
  IconUser: () => <svg />,
}));

describe('CredentialsBanner', () => {
  it('renders the OAuth fallback title and description for UsingOrgCredentials', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.UsingOrgCredentials}
        authenticationType={ToolsetAuthenticationType.OAuth}
      />,
    );
    expect(
      screen.getByText(
        'You are currently using organization credentials to access this toolset.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Login using personal account to have access to your data.',
      ),
    ).toBeTruthy();
  });

  it('renders the API-key fallback wording for UsingOrgCredentials', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.UsingOrgCredentials}
        authenticationType={ToolsetAuthenticationType.ApiKey}
      />,
    );
    expect(
      screen.getByText(
        'You are currently using organization API key to access this toolset.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Configure your personal API key to have access to your data.',
      ),
    ).toBeTruthy();
  });

  it('renders a single-line active-status message for OrgCredentialsActive', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.OrgCredentialsActive}
        authenticationType={ToolsetAuthenticationType.OAuth}
      />,
    );
    expect(
      screen.getByText('Signed in with organization credentials.'),
    ).toBeTruthy();
  });

  it('renders the API-key wording for OrgCredentialsActive', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.OrgCredentialsActive}
        authenticationType={ToolsetAuthenticationType.ApiKey}
      />,
    );
    expect(
      screen.getByText('Signed in with organization API key.'),
    ).toBeTruthy();
  });

  it('renders the description below the title, in that DOM order', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.UsingOrgCredentials}
        authenticationType={ToolsetAuthenticationType.OAuth}
      />,
    );
    const status = screen.getByRole('status');
    const text = status.textContent ?? '';
    expect(
      text.indexOf('You are currently using organization credentials'),
    ).toBeLessThan(text.indexOf('Login using personal account'));
  });

  it('uses texts overrides when provided', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.OrgCredentialsActive}
        authenticationType={ToolsetAuthenticationType.OAuth}
        texts={{ orgCredentialsActiveBannerTitle: () => 'Custom banner' }}
      />,
    );
    expect(screen.getByText('Custom banner')).toBeTruthy();
  });

  it('renders a single-line active-status message for PersonalCredentialsActive', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.PersonalCredentialsActive}
        authenticationType={ToolsetAuthenticationType.OAuth}
      />,
    );
    expect(
      screen.getByText('Signed in with personal credentials.'),
    ).toBeTruthy();
  });

  it('renders the API-key wording for PersonalCredentialsActive', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.PersonalCredentialsActive}
        authenticationType={ToolsetAuthenticationType.ApiKey}
      />,
    );
    expect(screen.getByText('Signed in with personal API key.')).toBeTruthy();
  });

  it('uses texts.personalCredentialsActiveBannerTitle when provided', () => {
    render(
      <CredentialsBanner
        state={CredentialsBannerState.PersonalCredentialsActive}
        authenticationType={ToolsetAuthenticationType.OAuth}
        texts={{
          personalCredentialsActiveBannerTitle: () => 'Custom personal banner',
        }}
      />,
    );
    expect(screen.getByText('Custom personal banner')).toBeTruthy();
  });
});
