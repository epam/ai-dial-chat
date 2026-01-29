import { OAuthConfig, OAuthUserConfig } from 'next-auth/providers';
import { GitLabProfile } from 'next-auth/providers/gitlab';

export function GitLab<P extends GitLabProfile>(
  options: OAuthUserConfig<P> & { gitlabHost?: string },
): OAuthConfig<P> {
  const host = options.gitlabHost ?? 'https://gitlab.com';

  return {
    id: 'gitlab',
    name: 'GitLab',
    type: 'oauth',
    authorization: {
      params: { scope: 'read_user' },
    },
    wellKnown: `${host}/.well-known/openid-configuration`,
    idToken: true,
    checks: ['pkce', 'state'],
    profile(profile) {
      return {
        id: profile?.sub ?? profile?.email,
        name: profile?.name ?? profile?.username,
        email: profile?.email,
        image: profile?.avatar_url,
      };
    },
    style: {
      logo: '/gitlab.svg',
      logoDark: '/gitlab-dark.svg',
      bg: '#fff',
      text: '#FC6D26',
      bgDark: '#FC6D26',
      textDark: '#fff',
    },
    options,
  };
}
