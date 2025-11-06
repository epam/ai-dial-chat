import { BaseElement } from '../webElements';
import { BasePage } from './basePage';

import { AuthProvider } from '@/src/testData';
import { Auth0Selectors } from '@/src/ui/selectors';

export class LoginPage extends BasePage {
  public auth0SignInButton = new BaseElement(
    this.page,
    Auth0Selectors.ssoSignIn(AuthProvider.auth0),
  );

  public keycloakSignInButton = new BaseElement(
    this.page,
    Auth0Selectors.ssoSignIn(AuthProvider.keycloak),
  );
}
