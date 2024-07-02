import { ExpectedMessages } from '@/src/testData';
import { LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { OverlayHomePage } from '@/src/ui/pages/overlayHomePage';
import { OverlayLoginPage } from '@/src/ui/pages/overlayLoginPage';
import test, { expect } from '@playwright/test';

const usernames = process.env.E2E_USERNAME!.split(',');

test('Overlay test', async ({ page }) => {
  const overlayLoginPage = new OverlayLoginPage(page);
  await overlayLoginPage.navigateToUrl('/cases/overlay');
  const newPage = await overlayLoginPage.clickLoginButton();

  const loginPage = new LoginPage(newPage);
  await newPage.waitForLoadState();
  await loginPage.ssoSignInButton.click();

  const auth0Page = new Auth0Page(newPage);
  await newPage.waitForLoadState();
  const auth0Form = auth0Page.getAuth0();
  await auth0Form.setCredentials(usernames[0], process.env.E2E_PASSWORD!);
  await auth0Form.loginButton.click();

  const overlayHomePage = new OverlayHomePage(page);
  const overlayContainer = overlayHomePage.getOverlayContainer();
  const overlayChat = overlayContainer.getChat();
  const overlayHeader = overlayContainer.getHeader();

  await expect
    .soft(
      overlayContainer.getConversationSettings().getElementLocator(),
      ExpectedMessages.conversationSettingsVisible,
    )
    .toBeVisible();
  await expect
    .soft(
      overlayHeader.chatPanelToggle.getElementLocator(),
      ExpectedMessages.sideBarPanelIsHidden,
    )
    .toBeVisible();
  await expect
    .soft(
      overlayHeader.promptsPanelToggle.getElementLocator(),
      ExpectedMessages.sideBarPanelIsHidden,
    )
    .toBeVisible();

  const userRequest = '1+2';
  await overlayChat.sendRequestWithButton(userRequest);

  const overlayChatHeader = overlayChat.getChatHeader();
  await expect
    .soft(
      overlayChatHeader.clearConversation.getElementLocator(),
      ExpectedMessages.headerCleanConversationIconVisible,
    )
    .toBeVisible();
  await expect
    .soft(
      overlayChatHeader.openConversationSettings.getElementLocator(),
      ExpectedMessages.conversationSettingsVisible,
    )
    .toBeVisible();

  const overlayChatTitle =
    await overlayChatHeader.chatTitle.getElementInnerContent();
  expect
    .soft(overlayChatTitle, ExpectedMessages.headerTitleCorrespondRequest)
    .toContain(userRequest);

  await expect
    .soft(
      overlayChatHeader.chatModelIcon.getElementLocator(),
      ExpectedMessages.entityIconIsValid,
    )
    .toBeVisible();
});
