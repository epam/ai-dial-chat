import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  Groups,
  ModelIds,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  '"Talk to" icons on See full list screen.\n' +
    'Addon icons on See full addons screen.\n' +
    'Chat icon is changed in the tree according to selected "Talk to" item on default new chat screen',
  async ({
    dialHomePage,
    talkToSelector,
    modelsDialog,
    addons,
    addonsDialog,
    conversations,
    iconApiHelper,
    setTestIds,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-1036', 'EPMRTC-1038', 'EPMRTC-378');
    await dialTest.step(
      'Open initial screen and click "See full list" to view all available entities',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.seeFullList();
      },
    );

    await dialTest.step('Verify all entities have valid icons', async () => {
      const allExpectedEntities = ModelsUtil.getOpenAIEntities();
      const actualEntitiesIcons = await modelsDialog.getEntitiesIcons();
      expect
        .soft(
          actualEntitiesIcons.length,
          ExpectedMessages.entitiesIconsCountIsValid,
        )
        .toBe(allExpectedEntities.length);

      const randomEntity =
        GeneratorUtil.randomArrayElement(allExpectedEntities);
      const actualEntity = actualEntitiesIcons.find(
        (e) => e.entityName === randomEntity.name,
      )!;
      const expectedEntityIcon =
        await iconApiHelper.getEntityIcon(randomEntity);
      expect
        .soft(
          actualEntity.icon,
          `${ExpectedMessages.entityIconIsValid} for ${randomEntity.name}`,
        )
        .toBe(expectedEntityIcon);
      await modelsDialog.closeDialog();
    });

    await dialTest.step(
      'Click "See all addons" and verify all addons have valid icons',
      async () => {
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
          (a) => a.entityName === randomAddon.name,
        )!;
        const expectedAddonIcon =
          await iconApiHelper.getEntityIcon(randomAddon);
        expect
          .soft(
            actualAddon.icon,
            `${ExpectedMessages.addonIconIsValid} for ${randomAddon.name}`,
          )
          .toBe(expectedAddonIcon);
        await addonsDialog.closeDialog();
      },
    );

    await dialTest.step(
      'Verify default model icon is displayed on chat bar panel',
      async () => {
        const defaultConversationIcon = await conversations.getConversationIcon(
          ExpectedConstants.newConversationTitle,
        );
        const defaultModel = ModelsUtil.getDefaultModel()!;
        const expectedDefaultIcon =
          await iconApiHelper.getEntityIcon(defaultModel);
        expect
          .soft(defaultConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedDefaultIcon);
      },
    );

    await dialTest.step(
      'Select any entity and verify corresponding icon is displayed on chat bar panel',
      async () => {
        const randomEntity = GeneratorUtil.randomArrayElement(
          ModelsUtil.getModels(),
        );
        await talkToSelector.selectEntity(randomEntity.name, Groups.models);

        const conversationIcon = await conversations.getConversationIcon(
          ExpectedConstants.newConversationTitle,
        );
        const expectedIcon = await iconApiHelper.getEntityIcon(randomEntity);

        expect
          .soft(conversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedIcon);
      },
    );
  },
);

dialTest(
  '"Talk to" item icon is jumping while generating an answer',
  async ({ dialHomePage, talkToSelector, chat, setTestIds, chatMessages }) => {
    setTestIds('EPMRTC-386');
    const model = ModelsUtil.getModel(ModelIds.GPT_4_32K)!;

    await dialTest.step(
      'Create a new conversation based on default model and send a request',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectModel(model.name, model.iconUrl);
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
        await chat.regenerate.waitForState();

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
