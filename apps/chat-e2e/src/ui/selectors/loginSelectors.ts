import { AuthProvider } from '@/src/testData';

export const Auth0Selectors = {
  auth0Container: '.auth0-lock-widget-container',
  ssoSignIn: (authProvider: AuthProvider) =>
    `form[action$=${authProvider}] > button`,
  username: '[name="email"]',
  password: '[name="password"]',
  login: '[name="submit"]',
};

export const KeycloakSelectors = {
  keycloakContainer: '#lightbox',
  email: '[name="loginfmt"]',
  password: '[name="passwd"]',
  nextButton: '[value="Next"]',
  signiInButton: '[value="Sign in"]',
};
