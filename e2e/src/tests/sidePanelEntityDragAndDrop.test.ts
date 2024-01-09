import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedMessages,
  FolderConversation,
  FolderPrompt,
} from '@/e2e/src/testData';
import { Colors } from '@/e2e/src/ui/domData';
import { ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: OpenAIEntityModel;
test.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
});

test('Chat is moved from the folder via drag&drop', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversations,
  chatBar,
  page,
  setTestIds,
}) => {
  setTestIds('EPMRTC-861');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );
  await localStorageManager.setOpenedFolders(conversationInFolder.folders);
  await localStorageManager.setSelectedConversation(
    conversationInFolder.conversations[0],
  );
  await dialHomePage.openHomePage({
    iconsToBeLoaded: [gpt35Model.iconUrl],
  });
  await dialHomePage.waitForPageLoaded();
  await chatBar.drugConversationFromFolder(
    conversationInFolder.folders.name,
    conversationInFolder.conversations[0].name,
  );
  const draggableAreaColor = await chatBar.getDraggableAreaColor();
  expect
    .soft(draggableAreaColor, ExpectedMessages.draggableAreaColorIsValid)
    .toBe(Colors.backgroundAccentSecondary);
  await page.mouse.up();

  expect
    .soft(
      await folderConversations.isFolderEntityVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations[0].name,
      ),
      ExpectedMessages.conversationMovedToFolder,
    )
    .toBeFalsy();

  const todayConversations = await conversations.getTodayConversations();
  expect
    .soft(
      todayConversations.includes(conversationInFolder.conversations[0].name),
      ExpectedMessages.conversationOfToday,
    )
    .toBeTruthy();

  const folderNameColor = await folderConversations.getFolderNameColor(
    conversationInFolder.folders.name,
  );
  expect
    .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
    .toBe(Colors.textPrimary);
});

test(
  'Chat is moved using drag&drop to collapsed folder.\n' +
    'Chat is moved using drag&drop to collapsed folder',
  async ({
    dialHomePage,
    conversationData,
    conversations,
    folderConversations,
    localStorageManager,
    chatBar,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMRTC-1599', 'EPMRTC-591');
    let nestedFolders: FolderInterface[];
    let conversationToDrop: Conversation;
    let conversation: Conversation;

    await test.step('Prepare nested folders and single conversations outside folder', async () => {
      nestedFolders = conversationData.prepareNestedFolder(3);
      conversationData.resetData();
      conversationToDrop = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      conversation = conversationData.prepareDefaultConversation();

      await localStorageManager.setFolders(...nestedFolders);
      await localStorageManager.setOpenedFolders(
        nestedFolders[1],
        nestedFolders[2],
        nestedFolders[3],
      );
      await localStorageManager.setConversationHistory(
        conversationToDrop,
        conversation,
      );
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Open app, drag conversation to collapsed folder and verify folders hierarchy is expanded, background is highlighted', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chatBar.drugConversationToFolder(
        nestedFolders[0].name,
        conversationToDrop.name,
      );
      for (const folder of nestedFolders) {
        await folderConversations.getFolderByName(folder.name).waitFor();
      }
      const folderBackgroundColor =
        await folderConversations.getFolderGroupBackgroundColor(
          nestedFolders[0].name,
        );
      expect
        .soft(folderBackgroundColor, ExpectedMessages.folderIsHighlighted)
        .toBe(Colors.backgroundAccentSecondary);
      await page.mouse.up();
    });

    await test.step('Verify conversation is moving to root folder, another conversation remained selected', async () => {
      await folderConversations
        .getFolderEntity(nestedFolders[0].name, conversationToDrop.name)
        .waitFor();
      const conversationBackgroundColor =
        await conversations.getConversationBackgroundColor(conversation.name);
      expect
        .soft(
          conversationBackgroundColor,
          ExpectedMessages.conversationIsSelected,
        )
        .toBe(Colors.backgroundAccentSecondary);
    });
  },
);

test('Chat is moved using drag&drop to expanded folder', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  chatBar,
  setTestIds,
  setIssueIds,
}) => {
  setTestIds('EPMRTC-941');
  setIssueIds('482');
  let folderConversation: FolderConversation;
  let conversationToDrop: Conversation;

  await test.step('Prepare folder with 2 conversation inside and 2 single conversations outside folder', async () => {
    folderConversation = conversationData.prepareFolderWithConversations(2);
    conversationData.resetData();
    conversationToDrop = conversationData.prepareDefaultConversation();

    await localStorageManager.setFolders(folderConversation.folders);
    await localStorageManager.setOpenedFolders(folderConversation.folders);
    await localStorageManager.setConversationHistory(
      ...folderConversation.conversations,
      conversationToDrop,
    );
    await localStorageManager.setSelectedConversation(conversationToDrop);
  });

  await test.step('Open app, drag 1st conversation to expanded folder conversation and verify conversation stays in the folder, folder remains expanded, folder name is highlighted', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatBar.drugAndDropConversationToFolderConversation(
      folderConversation.folders.name,
      folderConversation.conversations[1].name,
      conversationToDrop.name,
    );

    const folderConversationsCount =
      await folderConversations.getFolderEntitiesCount(
        folderConversation.folders.name,
      );
    expect
      .soft(folderConversationsCount, ExpectedMessages.folderIsHighlighted)
      .toBe(folderConversation.conversations.length + 1);

    const folderNameColor = await folderConversations.getFolderNameColor(
      folderConversation.folders.name,
    );
    expect
      .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
      .toBe(Colors.textAccentSecondary);
  });
});

test('Prompt is moved out of the folder via drag&drop', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  prompts,
  promptBar,
  setTestIds,
}) => {
  setTestIds('EPMRTC-961');
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  await localStorageManager.setFolders(promptInFolder.folders);
  await localStorageManager.setPrompts(promptInFolder.prompts[0]);
  await localStorageManager.setOpenedFolders(promptInFolder.folders);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await promptBar.dragAndDropPromptFromFolder(
    promptInFolder.folders.name,
    promptInFolder.prompts[0].name,
  );
  expect
    .soft(
      await folderPrompts.isFolderEntityVisible(
        promptInFolder.folders.name,
        promptInFolder.prompts[0].name,
      ),
      ExpectedMessages.promptMovedToFolder,
    )
    .toBeFalsy();

  const isPromptVisible = await prompts
    .getPromptByName(promptInFolder.prompts[0].name)
    .isVisible();
  expect.soft(isPromptVisible, ExpectedMessages.promptIsVisible).toBeTruthy();
});

test('Prompt is moved using drag&drop to collapsed folder', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  promptBar,
  page,
  setTestIds,
}) => {
  setTestIds('EPMRTC-959');
  let folders: FolderInterface[];
  let prompt: Prompt;

  await test.step('Prepare nested folders and prompt outside folder', async () => {
    folders = promptData.prepareNestedFolder(1);
    promptData.resetData();
    prompt = promptData.prepareDefaultPrompt();

    await localStorageManager.setFolders(...folders);
    await localStorageManager.setPrompts(prompt);
  });

  await test.step('Drag and drop prompt to root folder name and verify folder is highlighted, prompt stays inside folder, folder is expanded', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await promptBar.drugPromptToFolder(folders[0].name, prompt.name);
    await folderPrompts.getFolderByName(folders[1].name).waitFor();

    const folderBackgroundColor =
      await folderPrompts.getFolderGroupBackgroundColor(folders[0].name);
    expect
      .soft(folderBackgroundColor, ExpectedMessages.folderIsHighlighted)
      .toBe(Colors.backgroundAccentTertiary);
    await page.mouse.up();
    await folderPrompts.getFolderEntity(folders[0].name, prompt.name).waitFor();
  });
});

test('Prompt is moved using drag&drop to expanded folder', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  promptBar,
  setTestIds,
}) => {
  setTestIds('EPMRTC-960');
  let promptInFolder: FolderPrompt;
  let prompt: Prompt;

  await test.step('Prepare folder with prompt and prompt outside folder', async () => {
    promptInFolder = promptData.preparePromptsInFolder(1);
    promptData.resetData();
    prompt = promptData.prepareDefaultPrompt();

    await localStorageManager.setFolders(promptInFolder.folders);
    await localStorageManager.setOpenedFolders(promptInFolder.folders);
    await localStorageManager.setPrompts(...promptInFolder.prompts, prompt);
  });

  await test.step('Drag and drop prompt to prompt inside folder and verify prompt stays inside folder, folder remains expanded', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await promptBar.drugAndDropPromptToFolderPrompt(
      promptInFolder.folders.name,
      promptInFolder.prompts[0].name,
      prompt.name,
    );
    await folderPrompts
      .getFolderEntity(promptInFolder.folders.name, prompt.name)
      .waitFor();
  });
});
