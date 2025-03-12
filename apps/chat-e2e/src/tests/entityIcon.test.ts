import { DialAIEntityModel } from '@/chat/types/models';
import { noSimpleModelSkipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages } from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let simpleRequestModel: DialAIEntityModel | undefined;

dialTest.beforeAll(async () => {
  simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
});

dialTest(
  '[Select an agent for conversation] Agent ICONs are shown correctly. Set in config.\n' +
    'Addon icons on See full addons screen',
  async ({
    dialHomePage,
    talkToAgentDialog,
    addons,
    addonsDialog,
    iconApiHelper,
    addonsDialogAssertion,
    marketplaceAgentsAssertion,
    chat,
    setTestIds,
    localStorageManager,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-1036', 'EPMRTC-1038');

    await dialTest.step(
      'Open "Select an agent for conversation" modal for new conversation',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.waitForState();
      },
    );

    await dialTest.step('Verify all agents have valid icons', async () => {
      const actualIcons = await talkToAgentDialog.getAgents().getAgentsIcons();
      for (const actualIcon of actualIcons) {
        const expectedEntityIcon = iconApiHelper.getEntityIcon(
          ModelsUtil.getOpenAIEntity(actualIcon.entityId)!,
        );
        await marketplaceAgentsAssertion.assertEntityIcon(
          actualIcon.iconLocator,
          expectedEntityIcon,
        );
      }
      await talkToAgentDialog.cancelButton.click();
    });

    await dialTest.step(
      'Click "See all addons" and verify all addons have valid icons',
      async () => {
        await chat.configureSettingsButton.click();
        await addons.seeAllAddons();
        const actualAddonsIcons = await addonsDialog.getAddonsIcons();
        for (const actualIcon of actualAddonsIcons) {
          const expectedAddonIcon = iconApiHelper.getEntityIcon(
            ModelsUtil.getAddon(actualIcon.entityId)!,
          );
          await addonsDialogAssertion.assertEntityIcon(
            actualIcon.iconLocator,
            expectedAddonIcon,
          );
        }
        await addonsDialog.closeDialog();
      },
    );
  },
);

//TC depends on LLM availability and response
dialTest.skip(
  '"Talk to" item icon is jumping while generating an answer',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    conversationData,
    dataInjector,
    localStorageManager,
    conversations,
  }) => {
    dialTest.skip(simpleRequestModel === undefined, noSimpleModelSkipReason);
    setTestIds('EPMRTC-386');

    await dialTest.step(
      'Create a new conversation based on Gpt model and send a request',
      async () => {
        const conversation =
          conversationData.prepareEmptyConversation(simpleRequestModel);
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIds(simpleRequestModel!);
        await localStorageManager.setShowSideBarPanels();

        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await dialHomePage.throttleAPIResponse(API.chatHost);
        await chat.sendRequestWithButton('write down 15 adjectives', false);
      },
    );

    await dialTest.step(
      'Verify app icon is jumping in chat while responding',
      async () => {
        const jumpingIcon = await chatMessages.getMessageJumpingIcon();
        await jumpingIcon.waitFor();
      },
    );

    await dialTest.step(
      'Send one more request and verify model icon size remained the same',
      async () => {
        const initialMessageIconSize = await chatMessages.getMessageIconSize();
        await chatMessages.regenerate.waitForState();

        await chat.sendRequestWithButton('1+2=', false);
        const lastMessageIconSize = await chatMessages.getMessageIconSize();
        expect
          .soft(
            JSON.stringify(lastMessageIconSize),
            ExpectedMessages.iconSizeIsValid,
          )
          .toBe(JSON.stringify(initialMessageIconSize));
      },
    );
  },
);
