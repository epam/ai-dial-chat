import { OAuthConfig, OAuthUserConfig } from 'next-auth/providers';

// from https://github.com/nextauthjs/next-auth/pull/6614

export interface PingProfile
  extends Record<string, string | string[] | number> {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  acr: string;
  amr: [string];
  auth_time: number;
  at_hash: string;
  sid: string;
  preferred_username: string;
  given_name: string;
  picture: string;
  updated_at: number;
  name: string;
  family_name: string;
  email: string;
  env: string;
  org: string;
  'p1.region': string;
}

export default function PingId<P extends PingProfile>(
  options: OAuthUserConfig<P>,
): OAuthConfig<P> {
  return {
    id: 'ping-id',
    name: 'Ping Identity',
    type: 'oauth',
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name ?? profile.given_name + ' ' + profile.family_name,
        email: profile.email,
        image: profile.picture,
      };
    },
    options,
    style: {
      bg: '#b3282d',
      bgDark: '#b3282d',
      logo: '',
      logoDark: '',
      text: '#fff',
      textDark: '#fff',
    },
  };
}
