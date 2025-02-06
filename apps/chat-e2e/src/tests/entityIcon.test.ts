import { DialAIEntityModel } from '@/chat/types/models';
import { noSimpleModelSkipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let simpleRequestModel: DialAIEntityModel | undefined;

dialTest.beforeAll(async () => {
  simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
});

dialTest(
  '"Talk to" icons on See full list screen.\n' +
    'Addon icons on See full addons screen',
  async ({
    dialHomePage,
    talkToAgentDialog,
    header,
    addons,
    addonsDialog,
    iconApiHelper,
    localStorageManager,
    marketplaceContainer,
    marketplaceAgents,
    addonsDialogAssertion,
    marketplaceAgentsAssertion,
    chat,
    setTestIds,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-1036', 'EPMRTC-1038');

    const allExpectedEntities = ModelsUtil.getLatestOpenAIEntities();
    const randomEntity = GeneratorUtil.randomArrayElement(allExpectedEntities);
    const randomUpdateEntity = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );
    const defaultModel = ModelsUtil.getDefaultModel()!;

    await dialTest.step(
      'Open initial screen and click "Go to my workspace" to view all available entities',
      async () => {
        await localStorageManager.setRecentModelsIds(
          defaultModel,
          randomUpdateEntity,
        );
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.goToMyWorkspace();
        await marketplaceContainer.goToMarketplaceHome();
      },
    );

    await dialTest.step('Verify all entities have valid icons', async () => {
      await marketplaceAgents.waitForAgentByIndex(allExpectedEntities.length);

      const actualIcons = await marketplaceAgents.getAgentsIcons();
      expect
        .soft(actualIcons.length, ExpectedMessages.entitiesIconsCountIsValid)
        .toBe(allExpectedEntities.length);

      const actualEntity = actualIcons.find(
        (e) => e.entityId === randomEntity.id,
      )!;
      const expectedEntityIcon = iconApiHelper.getEntityIcon(randomEntity);
      await marketplaceAgentsAssertion.assertEntityIcon(
        actualEntity.iconLocator,
        expectedEntityIcon,
      );
    });

    await dialTest.step(
      'Click "See all addons" and verify all addons have valid icons',
      async () => {
        await header.backToChatButton.click();
        await chat.configureSettingsButton.click();
        const expectedAddons = ModelsUtil.getAddons();
        await addons.seeAllAddons();
        const actualAddonsIcons = await addonsDialog.getAddonsIcons();
        expect
          .soft(
            actualAddonsIcons.length,
            ExpectedMessages.addonsIconsCountIsValid,
          )
          .toBeGreaterThanOrEqual(expectedAddons.length);

        const randomAddon = GeneratorUtil.randomArrayElement(expectedAddons);
        const actualAddon = actualAddonsIcons.find(
          (a) => a.entityId === randomAddon.id,
        )!;
        const expectedAddonIcon = iconApiHelper.getEntityIcon(randomAddon);
        await addonsDialogAssertion.assertEntityIcon(
          actualAddon.iconLocator,
          expectedAddonIcon,
        );
        await addonsDialog.closeDialog();
      },
    );
  },
);

dialTest(
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
