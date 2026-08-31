import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
  OverlaySandboxUrls,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { Toolset } from '@epam/ai-dial-shared';

for (const isFeatureEnabled of [true, false]) {
  dialOverlayTest(
    `[Overlay] Feature.LiveChatInteraction is ${isFeatureEnabled}`,
    async ({
      overlayHomePage,
      overlayNavigationPanel,
      overlayMarketplacePage,
      overlayMarketplaceEntitiesSection,
      overlayMarketplaceEntities,
      overlayAgentDropdownMenu,
      overlayQuickApp2EditorViewForm,
      overlaySendMessage,
      overlayToolsetApiHelper,
      overlayToolsetSignInMock,
      overlayToolsetLoginEventsModal,
      overlayApplicationApiHelper,
      overlayModelApiHelper,
      overlayBaseAssertion,
      toolsetBuilder,
      quickApp2Builder,
      setTestIds,
    }) => {
      setTestIds('EPMDIAL-2330');
      const toolsetName = GeneratorUtil.randomToolsetName();
      const toolsetEndpoint = GeneratorUtil.randomUrl();
      const quickAppName = GeneratorUtil.randomApplicationName();
      let toolset: Toolset;

      await dialOverlayTest.step(
        'Create a toolset which requires log in and leave it logged out',
        async () => {
          await overlayToolsetApiHelper.createToolset(
            toolsetBuilder.withDisplayName(toolsetName).build(),
          );
          toolset = (await overlayToolsetApiHelper.getToolset(toolsetName))!;
          const oauthMock = await overlayToolsetSignInMock.loggedOutOAuthMock(
            toolset,
            toolsetEndpoint,
          );
          await overlayToolsetSignInMock.setupToolsetsListingRoute(
            await overlayToolsetApiHelper.listToolsets(),
            [oauthMock],
          );
        },
      );

      await dialOverlayTest.step(
        'Create a Quick app 2.0 via API with a tool-supporting orchestrator and the logged-out toolset attached',
        async () => {
          const toolSupportingModel =
            await overlayModelApiHelper.getToolSupportingModel();
          await overlayApplicationApiHelper.createApplication(
            quickApp2Builder
              .withDisplayName(quickAppName)
              .withOrchestratorModel(toolSupportingModel.id)
              .addToolset(toolset.id!)
              .build(),
          );
        },
      );

      await dialOverlayTest.step(
        `Open the sandbox with Feature.LiveChatInteraction: ${isFeatureEnabled} and open the Quick app 2.0 in edit mode`,
        async () => {
          await overlayHomePage.navigateToUrl(
            isFeatureEnabled
              ? OverlaySandboxUrls.enableLiveChatInteractionUrl
              : OverlaySandboxUrls.disableLiveChatInteractionUrl,
          );
          await overlayHomePage.waitForPageLoaded();
          await overlayNavigationPanel.myWorkspaceButton.click();
          await overlayMarketplacePage.waitForPageLoaded();
          // await overlayMarketplaceHeader.getSearch().fillInInput(quickAppName);
          const agentElement =
            await overlayMarketplaceEntitiesSection.findEntityElement(
              quickAppName,
            );
          await agentElement.hoverOver();
          await overlayMarketplaceEntities
            .getEntityElementDotsMenu(agentElement)
            .click();
          await overlayAgentDropdownMenu.selectMenuOption(MenuOptions.edit);
          await overlayQuickApp2EditorViewForm.waitForState();
        },
      );

      await dialOverlayTest.step(
        'Send a message in the preview to try to trigger the toolset',
        async () => {
          await overlayToolsetSignInMock.setupSignInChannel([toolset]);
          await overlayHomePage.mockChatTextResponse(
            MockedChatApiResponseBodies.simpleTextBody,
            { isOverlay: true },
          );
          await overlayHomePage.getOverlayContainer().getTab('Preview').click();
          await overlaySendMessage.fillRequestData(
            GeneratorUtil.randomString(10),
          );
          await overlaySendMessage.sendMessageButton.click();
        },
      );

      await dialOverlayTest.step(
        `Verify the toolset login pop-up is ${isFeatureEnabled ? '' : 'not '}shown`,
        async () => {
          await overlayBaseAssertion.assertElementState(
            overlayToolsetLoginEventsModal,
            isFeatureEnabled ? 'visible' : 'hidden',
          );
          if (isFeatureEnabled) {
            await overlayBaseAssertion.assertElementText(
              overlayToolsetLoginEventsModal.header,
              ExpectedConstants.toolsetLoginRequiredTitle,
            );
          }
        },
      );
    },
  );
}
