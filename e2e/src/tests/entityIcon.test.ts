import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  Groups,
  ModelIds,
} from '@/e2e/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

test(
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
    apiHelper,
    setTestIds,
    setIssueIds,
  }) => {
    setTestIds('EPMRTC-1036', 'EPMRTC-1038', 'EPMRTC-378');
    setIssueIds('450');
    await test.step('Open initial screen and click "See full list" to view all available entities', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await talkToSelector.seeFullList();
    });

    await test.step('Verify all entities have valid icons', async () => {
      const allExpectedEntities = ModelsUtil.getOpenAIEntities();
      const actualEntitiesIcons = await modelsDialog.getEntitiesIcons();
      expect
        .soft(
          actualEntitiesIcons.length,
          ExpectedMessages.entitiesIconsCountIsValid,
        )
        .toBe(allExpectedEntities.length);

      for (const entity of allExpectedEntities) {
        const actualEntity = actualEntitiesIcons.find(
          (e) => e.entityName === entity.name,
        )!;
        const expectedEntityIcon = await apiHelper.getEntityIcon(entity);
        expect
          .soft(
            actualEntity.icon,
            `${ExpectedMessages.entityIconIsValid} for ${entity.name}`,
          )
          .toBe(expectedEntityIcon);
      }

      await modelsDialog.closeDialog();
    });

    await test.step('Click "See all addons" and verify all addons have valid icons', async () => {
      const expectedAddons = ModelsUtil.getAddons();
      await addons.seeAllAddons();
      const actualAddonsIcons = await addonsDialog.getAddonsIcons();
      expect
        .soft(
          actualAddonsIcons.length,
          ExpectedMessages.addonsIconsCountIsValid,
        )
        .toBeGreaterThanOrEqual(expectedAddons.length);

      for (const addon of expectedAddons) {
        const actualAddon = actualAddonsIcons.find(
          (a) => a.entityName === addon.name,
        )!;
        const expectedAddonIcon = await apiHelper.getEntityIcon(addon);
        expect
          .soft(
            actualAddon.icon,
            `${ExpectedMessages.addonIconIsValid} for ${addon.name}`,
          )
          .toBe(expectedAddonIcon);
      }

      await addonsDialog.closeDialog();
    });

    await test.step('Verify default model icon is displayed on chat bar panel', async () => {
      const defaultConversationIcon = await conversations.getConversationIcon(
        ExpectedConstants.newConversationTitle,
      );
      const defaultModel = ModelsUtil.getDefaultModel()!;
      const expectedDefaultIcon = await apiHelper.getEntityIcon(defaultModel);
      expect
        .soft(defaultConversationIcon, ExpectedMessages.entityIconIsValid)
        .toBe(expectedDefaultIcon);
    });

    await test.step('Select any entity and verify corresponding icon is displayed on chat bar panel', async () => {
      const randomEntity = GeneratorUtil.randomArrayElement(
        ModelsUtil.getModels(),
      );
      await talkToSelector.selectEntity(randomEntity.name, Groups.models);

      const conversationIcon = await conversations.getConversationIcon(
        ExpectedConstants.newConversationTitle,
      );
      const expectedIcon = await apiHelper.getEntityIcon(randomEntity);

      expect
        .soft(conversationIcon, ExpectedMessages.entityIconIsValid)
        .toBe(expectedIcon);
    });
  },
);

test('"Talk to" item icon is jumping while generating an answer', async ({
  dialHomePage,
  talkToSelector,
  chat,
  setTestIds,
  chatMessages,
}) => {
  setTestIds('EPMRTC-386');
  const model = ModelsUtil.getModel(ModelIds.GPT_4_32K)!;

  await test.step('Create a new conversation based on default model and send a request', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectModel(model.name);
    await chat.sendRequestWithButton('write down 15 adjectives', false);
  });

  await test.step('Verify app icon is jumping in chat while responding', async () => {
    const jumpingIcon = await chatMessages.getMessageJumpingIcon();
    await jumpingIcon.waitFor();
  });

  await test.step('Send one more request and verify model icon size remained the same', async () => {
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
  });
});
