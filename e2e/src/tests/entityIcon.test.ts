import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  Groups,
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
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1036', 'EPMRTC-1038', 'EPMRTC-378');
    await test.step('Open initial screen and click "See full list" to view all available entities', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await talkToSelector.seeFullList();
    });

    await test.step('Verify all entities have valid icons', async () => {
      const allExpectedEntities = ModelsUtil.getOpenAIEntities();
      const actualEntitiesIcons =
        await modelsDialog.getEntitiesIconAttributes();
      expect
        .soft(
          actualEntitiesIcons.length,
          ExpectedMessages.entitiesIconsCountIsValid,
        )
        .toBe(allExpectedEntities.length);

      for (const item of allExpectedEntities) {
        const actualEntityIcon = actualEntitiesIcons.find(
          (e) => e.iconEntity === item.id,
        )!;
        expect
          .soft(
            actualEntityIcon.iconUrl,
            ExpectedMessages.entityIconSourceIsValid,
          )
          .toBe(item.iconUrl);
      }

      await modelsDialog.closeDialog();
    });

    await test.step('Click "See all addons" and verify all addons have valid icons', async () => {
      const expectedAddons = ModelsUtil.getAddons();
      await addons.seeAllAddons();
      const actualAddonsIcons = await addonsDialog.getAddonsIconAttributes();
      expect
        .soft(
          actualAddonsIcons.length,
          ExpectedMessages.addonsIconsCountIsValid,
        )
        .toBeGreaterThanOrEqual(expectedAddons.length);

      for (const actualAddon of actualAddonsIcons) {
        const expectedIcon = expectedAddons.find(
          (a) => a.id === actualAddon.iconEntity,
        )!.iconUrl;
        expect
          .soft(actualAddon.iconUrl, ExpectedMessages.addonIconIsValid)
          .toBe(expectedIcon);
      }

      await addonsDialog.closeDialog();
    });

    await test.step('Verify default model icon is displayed on chat bar panel', async () => {
      const defaultConversationIcon =
        await conversations.getConversationIconAttributes(
          ExpectedConstants.newConversationTitle,
        );
      expect
        .soft(
          defaultConversationIcon.iconUrl,
          ExpectedMessages.chatBarIconSourceIsValid,
        )
        .toBe(ModelsUtil.getDefaultModel()!.iconUrl);
    });

    await test.step('Select any entity and verify corresponding icon is displayed on chat bar panel', async () => {
      const randomGroup = GeneratorUtil.randomArrayElement(
        Object.values(Groups),
      );
      const randomEntity = GeneratorUtil.randomArrayElement(
        ModelsUtil.getOpenAIEntities().filter((e) =>
          randomGroup.toLowerCase().includes(e.type),
        ),
      );
      await talkToSelector.selectEntity(randomEntity.name, randomGroup);

      const conversationIcon =
        await conversations.getConversationIconAttributes(
          ExpectedConstants.newConversationTitle,
        );
      expect
        .soft(
          conversationIcon.iconUrl,
          ExpectedMessages.chatBarIconSourceIsValid,
        )
        .toBe(randomEntity.iconUrl);
    });
  },
);

//TODO: need to re-implement to catch jumping icon
test.skip('"Talk to" item icon is jumping while generating an answer', async ({
  dialHomePage,
  talkToSelector,
  chat,
  setTestIds,
  chatMessages,
}) => {
  setTestIds('EPMRTC-386');
  const defaultModel = ModelsUtil.getDefaultModel()!;

  await test.step('Create a new conversation based on default model and send a request', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectModel(defaultModel.name);
    await chat.sendRequestWithButton('write down 10 adjectives', false);
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
        ExpectedMessages.chatBarIconSourceIsValid,
      )
      .toBe(JSON.stringify(initialMessageIconSize));
  });
});
