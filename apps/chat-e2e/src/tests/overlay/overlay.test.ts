import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';

for (const overlayUrl of ['/cases/overlay', '/cases/overlay-manager']) {
  dialOverlayTest(
    `Overlay test for url: "${overlayUrl}"`,
    async ({
      overlayHomePage,
      overlayContainer,
      overlayChat,
      overlayHeader,
      overlayChatHeader,
    }) => {
      await overlayHomePage.navigateToUrl(overlayUrl);
      if (overlayUrl.includes('overlay-manager')) {
        await overlayHomePage.overlayChatIcon.click();
      }
      await expect
        .soft(
          overlayContainer.getConversationSettings().getElementLocator(),
          ExpectedMessages.conversationSettingsVisible,
        )
        .toBeVisible();
      await expect
        .soft(
          overlayHeader.leftPanelToggle.getElementLocator(),
          ExpectedMessages.sideBarPanelIsHidden,
        )
        .toBeVisible();
      await expect
        .soft(
          overlayHeader.rightPanelToggle.getElementLocator(),
          ExpectedMessages.sideBarPanelIsHidden,
        )
        .toBeVisible();

      const overlayTheme = await overlayHomePage.getTheme();
      expect
        .soft(overlayTheme, ExpectedMessages.applicationThemeIsValid)
        .toContain('light');

      const userRequest = '1+2';
      await overlayChat.sendRequestWithButton(userRequest);
      //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/1742
      // expect
      //   .soft(request.modelId, ExpectedMessages.chatRequestModelIsValid)
      //   .toBe(ModelIds.GPT_4);

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
    },
  );
}
